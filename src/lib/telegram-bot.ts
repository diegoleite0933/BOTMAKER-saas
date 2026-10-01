import { Telegraf, Input } from "telegraf";
import { PrismaClient, Bot } from "@prisma/client";

const prisma = new PrismaClient();
const botInstances = new Map<string, Telegraf>();

export function getBot(botRecord: Bot): Telegraf {
  if (botInstances.has(botRecord.id)) {
    return botInstances.get(botRecord.id)!;
  }

  const bot = new Telegraf(botRecord.token);

  // Comando /start
  bot.start(async (ctx) => {
    try {
      const currentBot = await prisma.bot.findUnique({ where: { id: botRecord.id } });
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
          reply_markup: { inline_keyboard: buttons }
        });
      }
    } catch (err) {
      console.error(err);
      ctx.reply("Ocorreu um erro ao buscar os produtos.");
    }
  });

  // Ação de Compra
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

      if (botRecord.paymentMethod === "pix_direto") {
        if (!botRecord.pixKey) {
          return ctx.reply("❌ O administrador do bot ainda não configurou a Chave PIX.");
        }
        
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

        await ctx.reply(`💳 *PAGAMENTO VIA PIX DIRETO*\n\nProduto: ${product.name}\nValor: R$ ${product.price.toFixed(2)}\n\nEnvie o valor acima para a chave PIX abaixo:`, { parse_mode: 'Markdown' });
        await ctx.reply(`\`${botRecord.pixKey}\``, { parse_mode: 'Markdown' });
        
        return ctx.reply("📸 *ATENÇÃO:* Após realizar o pagamento, **envie a foto do comprovante** respondendo a esta mensagem para que o administrador possa liberar o seu acesso.", { parse_mode: 'Markdown' });
      }

      // Caso Mercado Pago
      if (botRecord.paymentMethod === "mercadopago") {
        const mpAccessToken = botRecord.mpAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!mpAccessToken || mpAccessToken === "seu_access_token_aqui") {
          return ctx.reply("❌ O administrador do bot ainda não configurou o Mercado Pago.");
        }

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
              identification: { type: "CPF", number: "19119119100" }
            }
          })
        });

        if (!response.ok) {
          return ctx.reply("❌ Falha na API do Mercado Pago.");
        }

        const paymentData = await response.json();
        
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

        const pixCode = paymentData.point_of_interaction.transaction_data.qr_code;
        await ctx.reply(`💳 *PAGAMENTO VIA PIX (Mercado Pago)*\n\nProduto: ${product.name}\nValor: R$ ${product.price.toFixed(2)}\n\nCopie o código abaixo e pague no seu banco:`, { parse_mode: 'Markdown' });
        await ctx.reply(`\`${pixCode}\``, { parse_mode: 'Markdown' });
        return;
      }

      // Caso Amplo Pay
      if (botRecord.paymentMethod === "amplopay") {
        const clientId = botRecord.amploPayClientId || process.env.AMPLOPAY_CLIENT_ID;
        const clientSecret = botRecord.amploPayClientSecret || process.env.AMPLOPAY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          return ctx.reply("❌ O administrador do bot ainda não configurou as chaves da Amplo Pay.");
        }

        const baseUrl = process.env.APP_URL || "http://localhost:3000";
        const webhookUrl = `${baseUrl}/api/webhooks/amplopay`;

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
          products: [{ id: product.id, name: product.name, quantity: 1, price: product.price }],
          metadata: { productId: product.id, telegramUserId: ctx.from.id.toString(), botId: botRecord.id },
          callbackUrl: webhookUrl
        };

        const response = await fetch("https://app.amplopay.com/api/v1/gateway/pix/receive", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-public-key": clientId,
            "x-secret-key": clientSecret
          },
          body: JSON.stringify(payload)
        });

        // Use node-fetch natively se não estiver em ambiente cloudflare, 
        // Em serverless / vercel, o IP da Vercel GERALMENTE passa no WAF da Amplo Pay.
        // Se falhar no futuro, recomendaremos webhook P2P.
        if (!response.ok) {
           console.log("Amplo Pay Erro HTTP", response.status);
           return ctx.reply("❌ Falha ao gerar PIX na Amplo Pay.");
        }
        
        const paymentData = await response.json();

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

  // Ação de Simular Pagamento (Teste Local)
  bot.action(/^simulate_pay_(.+)_(.+)$/, async (ctx) => {
    // mantido para retrocompatibilidade em dev
    await ctx.reply("Teste local finalizado. Verifique webhook.");
  });

  // Recebimento de Comprovantes (Pix Direto)
  bot.on('photo', async (ctx) => {
    try {
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

      const photo = ctx.message.photo[ctx.message.photo.length - 1]; 
      const fileId = photo.file_id;

      await ctx.reply("✅ Comprovante recebido! Ele foi enviado para a equipe de moderação. Assim que for aprovado, seu link será liberado aqui.");

      await prisma.order.update({
        where: { id: pendingOrder.id },
        data: {
          receiptUrl: fileId,
          status: "review" 
        }
      });
      
    } catch (err) {
      console.error(err);
    }
  });

  botInstances.set(botRecord.id, bot);
  return bot;
}
