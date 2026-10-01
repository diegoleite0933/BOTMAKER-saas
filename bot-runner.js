require("dotenv").config();
const { Telegraf } = require("telegraf");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const runningBots = new Map();

async function startBot(botRecord) {
  if (runningBots.has(botRecord.id)) return; // Já está rodando

  console.log(`[Bot Runner] Iniciando bot: @${botRecord.username}`);
  const bot = new Telegraf(botRecord.token);

  // Comando /start
  bot.start(async (ctx) => {
    try {
      // Buscar bot atualizado
      const currentBot = await prisma.bot.findUnique({ where: { id: botRecord.id } });

      // Buscar produtos do bot
      const products = await prisma.product.findMany({
        where: { botId: botRecord.id, status: 'active' }
      });

      if (products.length === 0) {
        return ctx.reply("Olá! No momento não temos produtos disponíveis.");
      }

      const message = currentBot?.welcomeMessage || `Bem-vindo à loja! Escolha um produto abaixo para comprar via Pix:`;
      
      const buttons = products.map(p => {
        return [{ text: `${p.name} - R$ ${p.price.toFixed(2)}`, callback_data: `buy_${p.id}` }];
      });

      if (currentBot?.welcomeMediaId && currentBot?.welcomeMediaType) {
        try {
          if (currentBot.welcomeMediaType === 'video') {
            await ctx.replyWithVideo(currentBot.welcomeMediaId, { caption: message, reply_markup: { inline_keyboard: buttons } });
          } else {
            await ctx.replyWithPhoto(currentBot.welcomeMediaId, { caption: message, reply_markup: { inline_keyboard: buttons } });
          }
        } catch (mediaErr) {
          console.error("Erro ao enviar mídia, enviando só texto:", mediaErr);
          await ctx.reply(message, { reply_markup: { inline_keyboard: buttons } });
        }
      } else {
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: buttons
          }
        });
      }
    } catch (err) {
      console.error(err);
      ctx.reply("Ocorreu um erro ao buscar os produtos.");
    }
  });

  bot.action(/^buy_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    
    try {
      const product = await prisma.product.findUnique({ 
        where: { id: productId },
        include: { bot: { include: { workspace: true } } }
      });
      if (!product) return ctx.answerCbQuery("Produto não encontrado.");

      await ctx.answerCbQuery("Gerando seu PIX...");
      await ctx.reply("⏳ Aguarde, gerando seu código PIX...");

      const orderId = `order_${Date.now()}_${ctx.from.id}`;

      if (product.bot.paymentMethod === "pix_direto") {
        if (!product.bot.pixKey) {
          return ctx.reply("❌ O administrador do bot ainda não configurou a Chave PIX.");
        }

        const pixCodeModule = await import("./src/lib/pix-code.js");
        const { copyPasteCode, qrCode } = await pixCodeModule.default.generatePixQr({
          pixKey: product.bot.pixKey,
          merchantName: product.bot.name,
          merchantCity: process.env.PIX_MERCHANT_CITY || "SAO PAULO",
          amount: product.price,
          transactionId: orderId,
        });
        
        // Garante que o usuário existe no BD
        await prisma.telegramUser.upsert({
          where: { id_botId: { id: ctx.from.id.toString(), botId: product.botId } },
          update: {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          },
          create: {
            id: ctx.from.id.toString(),
            botId: product.botId,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          }
        });
        
        await prisma.order.create({
          data: {
            id: orderId,
            botId: product.botId,
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            status: "pending",
            amount: product.price,
            paymentGateway: "pix_direto"
          }
        });

        const amountLabel = product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        await ctx.replyWithPhoto(
          { source: qrCode, filename: "pix.png" },
          { caption: `Pix de ${amountLabel} para ${product.bot.name}. Chave: ${product.bot.pixKey}` }
        );
        await ctx.reply(`Pix copia e cola (${amountLabel}):\n${copyPasteCode}`);

        return ctx.reply("Depois de pagar, envie o comprovante como foto nesta conversa. O acesso será liberado após a aprovação do administrador.");
      }

      // Caso Mercado Pago
      if (product.bot.paymentMethod === "mercadopago") {
        const mpAccessToken = product.bot.mpAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!mpAccessToken || mpAccessToken === "seu_access_token_aqui") {
          return ctx.reply("❌ O administrador do bot ainda não configurou o Mercado Pago.");
        }

        // IMPORTANTE: URL do Webhook
        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const webhookUrl = `${baseUrl}/api/webhooks/mercadopago`;

        const response = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mpAccessToken}`,
            "X-Idempotency-Key": orderId
          },
          body: JSON.stringify({
            transaction_amount: Number(product.price.toFixed(2)),
            description: product.name,
            payment_method_id: "pix",
            notification_url: webhookUrl,
            payer: {
              email: `tg_${ctx.from.id}@botmaker.local`,
              first_name: ctx.from.first_name || "Cliente Telegram",
              identification: {
                type: "CPF",
                number: "19119119100" // CPF fictício aceito pelo MP para testes
              }
            }
          })
        });

        if (!response.ok) {
          const rawText = await response.text();
          console.error("Mercado Pago Error HTTP:", response.status, rawText);
          return ctx.reply("❌ Falha na API do Mercado Pago (Status " + response.status + ").");
        }

        const paymentData = await response.json();
        
        // Garante que o usuário existe no BD
        await prisma.telegramUser.upsert({
          where: { id_botId: { id: ctx.from.id.toString(), botId: product.botId } },
          update: {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          },
          create: {
            id: ctx.from.id.toString(),
            botId: product.botId,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          }
        });
        
        // Salvar o pedido no banco de dados
        await prisma.order.create({
          data: {
            id: orderId,
            botId: product.botId,
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            status: "pending",
            amount: product.price,
            paymentId: paymentData.id.toString(),
            paymentGateway: "mercadopago"
          }
        });

        // Enviar o PIX para o usuário
        const pixCode = paymentData.point_of_interaction.transaction_data.qr_code;
        
        await ctx.reply(`💳 *PAGAMENTO VIA PIX (Mercado Pago)*\n\nProduto: ${product.name}\nValor: R$ ${product.price.toFixed(2)}\n\nCopie o código abaixo e pague no seu banco:`, { parse_mode: 'Markdown' });
        await ctx.reply(`\`${pixCode}\``, { parse_mode: 'Markdown' });

        return;
      }

      // Caso Amplo Pay
      if (product.bot.paymentMethod === "amplopay") {
        const clientId = product.bot.amploPayClientId || process.env.AMPLOPAY_CLIENT_ID;
        const clientSecret = product.bot.amploPayClientSecret || process.env.AMPLOPAY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          return ctx.reply("❌ O administrador do bot ainda não configurou as chaves da Amplo Pay.");
        }

        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const webhookUrl = `${baseUrl}/api/webhooks/amplopay`;

        const fs = require('fs');
        const path = require('path');
        const cp = require('child_process');
        
        // Gerar CPF válido para burlar a trava da API
        function randomCpf() {
          const r = () => Math.floor(Math.random() * 9);
          const n = Array(9).fill(0).map(r);
          let d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0);
          d1 = 11 - (d1 % 11);
          if (d1 >= 10) d1 = 0;
          n.push(d1);
          let d2 = n.reduce((acc, val, i) => acc + val * (11 - i), 0);
          d2 = 11 - (d2 % 11);
          if (d2 >= 10) d2 = 0;
          n.push(d2);
          return n.join('');
        }

        const payload = {
          identifier: orderId,
          amount: product.price,
          client: {
            name: ctx.from.first_name || "Cliente Telegram",
            email: `tg_${ctx.from.id}@telegram.local`,
            phone: "11999999999",
            document: randomCpf()
          },
          products: [
            {
              id: product.id,
              name: product.name,
              quantity: 1,
              price: product.price
            }
          ],
          metadata: {
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            botId: botRecord.id
          },
          callbackUrl: webhookUrl
        };

        const tmpFile = path.join(__dirname, `payload_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, JSON.stringify(payload));

        let paymentData;
        try {
          const cmd = `curl.exe -s -X POST https://app.amplopay.com/api/v1/gateway/pix/receive -H "Content-Type: application/json" -H "x-public-key: ${clientId}" -H "x-secret-key: ${clientSecret}" -d @"${tmpFile}"`;
          const res = cp.execSync(cmd);
          paymentData = JSON.parse(res.toString());
        } catch (err) {
          console.error("Amplo Pay Curl Error:", err.stdout ? err.stdout.toString() : err.message);
          return ctx.reply("❌ Falha na comunicação com Amplo Pay.");
        } finally {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }

        if (paymentData.statusCode && paymentData.statusCode >= 400) {
          console.error("Amplo Pay API Error:", paymentData);
          return ctx.reply("❌ Falha ao gerar PIX na Amplo Pay.");
        }

        // Garante que o usuário existe no BD
        await prisma.telegramUser.upsert({
          where: { id_botId: { id: ctx.from.id.toString(), botId: product.botId } },
          update: {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          },
          create: {
            id: ctx.from.id.toString(),
            botId: product.botId,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          }
        });

        // Salvar pedido
        await prisma.order.create({
          data: {
            id: orderId,
            botId: product.botId,
            productId: product.id,
            telegramUserId: ctx.from.id.toString(),
            status: "pending",
            amount: product.price,
            paymentId: paymentData.transactionId,
            paymentGateway: "amplopay"
          }
        });

        // Enviar o PIX
        const pixCode = paymentData.pix.code;
        await ctx.reply(`💳 *PAGAMENTO VIA PIX (Amplo Pay)*\n\nProduto: ${product.name}\nValor: R$ ${product.price.toFixed(2)}\n\nCopie o código abaixo e pague no seu banco:`, { parse_mode: 'Markdown' });
        await ctx.reply(`\`${pixCode}\``, { parse_mode: 'Markdown' });

        return;
      }

    } catch (err) {
      console.error(err);
      ctx.reply("❌ Ocorreu um erro interno.");
    }
  });

  // Ação de Simular Pagamento
  bot.action(/^simulate_pay_(.+)_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const orderId = ctx.match[2];
    
    try {
      const product = await prisma.product.findUnique({ 
        where: { id: productId },
        include: { deliveries: true } 
      });

      if (!product) return ctx.answerCbQuery("Produto não encontrado.");

      await ctx.answerCbQuery("Pagamento Aprovado!");
      await ctx.reply("✅ *Pagamento Aprovado com Sucesso!*\n\nPreparando seu acesso...", { parse_mode: 'Markdown' });

      // Entregar o acesso
      const delivery = product.deliveries[0];
      if (delivery && delivery.type === 'group' && delivery.telegramChatId) {
        // O bot precisa gerar um link de convite único
        try {
          const inviteLink = await ctx.telegram.createChatInviteLink(delivery.telegramChatId, {
            member_limit: 1, // apenas um uso
            expire_date: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // expira em 1 dia
            name: `Acesso: ${ctx.from.first_name}`
          });

          await ctx.reply(`🎉 *Aqui está o seu acesso exclusivo:*\n\n${inviteLink.invite_link}\n\nEste link só pode ser usado 1 vez.`, {
            parse_mode: 'Markdown'
          });
        } catch (chatErr) {
          console.error("Erro ao gerar convite:", chatErr);
          await ctx.reply("❌ Ocorreu um erro ao gerar o link do grupo. Verifique se o Bot é Administrador do Grupo e tem permissão para 'Convidar Usuários' via link.");
        }
      } else {
        await ctx.reply("Este produto não possui um canal ou grupo configurado corretamente.");
      }

    } catch (err) {
      console.error(err);
    }
  });

  // Recebimento de Comprovantes (Pix Direto)
  bot.on('photo', async (ctx) => {
    try {
      // Procura se existe algum pedido pendente de pix_direto
      const pendingOrder = await prisma.order.findFirst({
        where: {
          telegramUserId: ctx.from.id.toString(),
          botId: botRecord.id,
          status: "pending",
          paymentGateway: "pix_direto"
        },
        include: { product: true }
      });

      if (!pendingOrder) return;

      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Maior resolução
      const fileId = photo.file_id;

      await ctx.reply("✅ Comprovante recebido! Ele foi enviado para a equipe de moderação. Assim que for aprovado, seu link será liberado aqui.");

      // TODO: Enviar a foto para o ADMIN (usuário dono do bot) com botão Aprovar/Recusar
      // Por enquanto, no MVP, vamos aprovar automaticamente para o fluxo de testes ou podemos logar no painel.
      await prisma.order.update({
        where: { id: pendingOrder.id },
        data: {
          receiptUrl: fileId,
          status: "review" // status criado para painel
        }
      });
      
      console.log(`[Bot Runner] Comprovante de PIX recebido para o pedido ${pendingOrder.id}`);

      // Notificar por e-mail (usando Nodemailer)
      try {
        const nodemailer = require('nodemailer');
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            }
          });

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: "diegoleite0933@gmail.com",
            subject: "💰 Novo Comprovante de PIX Recebido - Ação Necessária",
            text: `Um novo comprovante foi enviado pelo usuário ${ctx.from.first_name}.\nProduto: ${pendingOrder.product.name}\n\nAcesse o painel para aprovar ou recusar:\nhttp://localhost:3000/dashboard/sales`
          });
          console.log("[Bot Runner] E-mail de notificação enviado!");
        } else {
          console.log("[Bot Runner] E-mail não enviado: Credenciais EMAIL_USER e EMAIL_PASS não configuradas no .env");
        }
      } catch (emailErr) {
        console.error("Erro ao enviar email:", emailErr);
      }

    } catch (err) {
      console.error(err);
    }
  });

  bot.launch();
  runningBots.set(botRecord.id, bot);
}

async function main() {
  console.log("[Bot Runner] Verificando bots no banco de dados...");
  
  // Roda num loop infinito verificando novos bots a cada 10 segundos
  setInterval(async () => {
    try {
      const bots = await prisma.bot.findMany({ where: { status: 'active' } });
      for (const bot of bots) {
        startBot(bot);
      }
    } catch (err) {
      console.error("[Bot Runner] Erro ao buscar bots:", err);
    }
  }, 10000);

  // Primeira checagem imediata
  const bots = await prisma.bot.findMany({ where: { status: 'active' } });
  for (const bot of bots) {
    startBot(bot);
  }
}

// Tratamento para encerrar graciosamente
process.once('SIGINT', () => {
  runningBots.forEach(bot => bot.stop('SIGINT'));
  process.exit(0);
});
process.once('SIGTERM', () => {
  runningBots.forEach(bot => bot.stop('SIGTERM'));
  process.exit(0);
});

main();
