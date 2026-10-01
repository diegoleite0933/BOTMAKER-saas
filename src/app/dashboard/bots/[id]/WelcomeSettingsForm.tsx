"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WelcomeSettingsForm({ botId, initialMsg, initialStorageChat }: { botId: string, initialMsg: string | null, initialStorageChat: string | null }) {
  const [msg, setMsg] = useState(initialMsg || "");
  const [storageChatId, setStorageChatId] = useState(initialStorageChat || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function saveSettings() {
    setLoading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("botId", botId);
      formData.append("msg", msg);
      formData.append("storageChatId", storageChatId);
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch("/api/bots/welcome/upload", {
        method: "POST",
        body: formData
      });
      
      const data = await res.json();

      if (res.ok) {
        setMessage("Mensagem e Mídia salvas com sucesso!");
        setFile(null); // Limpar arquivo após upload
      } else {
        setMessage(data.message || "Erro ao salvar.");
      }
    } catch (e) {
      setMessage("Erro de conexão.");
    }
    setLoading(false);
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Mensagem de Boas-vindas</CardTitle>
        <CardDescription>Configure a mensagem inicial e faça o upload de uma mídia.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Texto da Mensagem</Label>
          <Textarea 
            value={msg} 
            onChange={e => setMsg(e.target.value)} 
            placeholder="Ex: Olá! Seja bem-vindo à nossa loja..." 
            rows={4}
          />
        </div>

        <div className="space-y-2 p-4 bg-slate-50 border rounded">
          <Label className="text-blue-700">Banco de Imagens (Canal/Grupo de Armazenamento)</Label>
          <Input 
            value={storageChatId} 
            onChange={e => setStorageChatId(e.target.value)} 
            placeholder="Ex: -100123456789" 
          />
          <p className="text-xs text-slate-500">
            Crie um grupo ou canal privado no Telegram, adicione o seu Bot como <b>Administrador</b> e cole o ID do canal aqui (deve começar com -100).
            O robô salvará as imagens que você enviar aqui dentro desse canal para usá-las depois.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Fazer Upload de Mídia (Imagem/Vídeo)</Label>
          <Input 
            type="file"
            accept="image/*,video/mp4"
            onChange={e => setFile(e.target.files?.[0] || null)} 
          />
          <p className="text-xs text-slate-500">
            A mídia será enviada para o seu Banco de Imagens no Telegram e o bot usará ela nativamente!
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <span className="text-sm text-green-600">{message}</span>
        <Button onClick={saveSettings} disabled={loading}>{loading ? "Enviando pro Telegram..." : "Salvar Mídia & Mensagem"}</Button>
      </CardFooter>
    </Card>
  );
}
