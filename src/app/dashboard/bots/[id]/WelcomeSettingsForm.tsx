"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WelcomeSettingsForm({ botId, initialMsg, initialStorageChat, initialMediaCount }: { botId: string, initialMsg: string | null, initialStorageChat: string | null, initialMediaCount: number }) {
  const [msg, setMsg] = useState(initialMsg || "");
  const [storageChatId, setStorageChatId] = useState(initialStorageChat || "");
  const [files, setFiles] = useState<File[]>([]);
  const [savedMediaCount, setSavedMediaCount] = useState(initialMediaCount);
  const [clearSavedMedia, setClearSavedMedia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function saveSettings() {
    setLoading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("botId", botId);
      formData.append("msg", msg);
      formData.append("storageChatId", storageChatId);
      const replaceMedia = files.length > 0 || clearSavedMedia;
      formData.append("replaceMedia", String(replaceMedia));
      formData.append("clearMedia", String(clearSavedMedia));
      files.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/bots/welcome/upload", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();

      if (res.ok) {
        setFeedback({ type: "success", text: "Mensagem e mídias salvas com sucesso!" });
        if (replaceMedia) setSavedMediaCount(files.length);
        setFiles([]);
        setClearSavedMedia(false);
      } else {
        setFeedback({ type: "error", text: data.message || "Erro ao salvar." });
      }
    } catch {
      setFeedback({ type: "error", text: "Erro de conexão." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Mensagem de Boas-vindas</CardTitle>
          <CardDescription>Configure a mensagem inicial e escolha até três imagens ou vídeos.</CardDescription>
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
          <Label htmlFor="welcome-media-files">Mídias de boas-vindas</Label>
          <Input 
            id="welcome-media-files"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              setFiles(selected.length <= 3 ? selected : []);
              setClearSavedMedia(false);
              setFeedback(selected.length > 3
                ? { type: "error", text: "Selecione no máximo três arquivos." }
                : null);
              event.target.value = "";
            }}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {files.length > 0
                ? `${files.length} arquivo(s) selecionado(s). Ao salvar, eles substituirão as mídias atuais.`
                : `${clearSavedMedia ? 0 : savedMediaCount}/3 mídias salvas. O upload vai para o canal de armazenamento do Telegram.`}
            </p>
            {savedMediaCount > 0 && !clearSavedMedia && (
              <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => { setFiles([]); setClearSavedMedia(true); }}>
                <Trash2 aria-hidden="true" className="size-4" /> Remover mídias salvas
              </Button>
            )}
          </div>
          {files.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-600">
              {files.map((file) => <li key={`${file.name}-${file.lastModified}`} className="truncate">{file.name}</li>)}
            </ul>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {feedback && <span role={feedback.type === "error" ? "alert" : "status"} className={`text-sm ${feedback.type === "error" ? "text-red-700" : "text-green-700"}`}>{feedback.text}</span>}
        <Button className="w-full sm:w-auto" onClick={saveSettings} disabled={loading}>{loading ? "Enviando pro Telegram..." : "Salvar Mídia & Mensagem"}</Button>
      </CardFooter>
    </Card>
  );
}
