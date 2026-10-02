"use client";

import { useState } from "react";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Campaign = {
  id: string;
  name: string;
  delayDays: number;
  message: string;
  mediaFileId: string | null;
  mediaType: "photo" | "video" | null;
  isActive: boolean;
};

export function RemarketingManager({ botId, initialCampaigns }: { botId: string; initialCampaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateCampaign(id: string, changes: Partial<Campaign>) {
    setCampaigns((current) => current.map((campaign) => campaign.id === id ? { ...campaign, ...changes } : campaign));
  }

  async function addCampaign() {
    setBusyAction("add");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/bots/remarketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, name: `Remarketing ${campaigns.length + 1}`, delayDays: 1, message: "", mediaFileId: "", mediaType: null, isActive: false }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível criar o remarketing.");
      setCampaigns((current) => [...current, result.campaign]);
      setMessage("Remarketing criado. Configure e salve para ativar.");
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Erro ao criar remarketing.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveCampaign(campaign: Campaign) {
    setBusyId(campaign.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/bots/remarketing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, ...campaign }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar o remarketing.");
      setCampaigns((current) => current.map((entry) => entry.id === campaign.id ? result.campaign : entry));
      setMessage(`${campaign.name} salvo.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar remarketing.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    setBusyId(campaign.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/bots/remarketing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, id: campaign.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível remover o remarketing.");
      setCampaigns((current) => current.filter((entry) => entry.id !== campaign.id));
      setMessage("Remarketing removido.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao remover remarketing.");
    } finally {
      setBusyId(null);
    }
  }

  async function uploadMedia(campaign: Campaign, file?: File) {
    if (!file) return;
    setBusyId(campaign.id);
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.set("botId", botId);
      formData.set("file", file);
      const response = await fetch("/api/bots/remarketing/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível enviar a mídia.");
      updateCampaign(campaign.id, { mediaFileId: result.mediaFileId, mediaType: result.mediaType });
      setMessage("Mídia enviada. Salve a campanha para confirmar.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Erro ao enviar mídia.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4 border-t border-slate-200 pt-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Relacionamento</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Remarketing</h2>
          <p className="mt-1 text-sm text-slate-600">Envie uma mensagem após o pagamento. Cada campanha é enviada uma vez por cliente.</p>
        </div>
        <Button type="button" variant="outline" onClick={addCampaign} disabled={campaigns.length >= 10 || busyAction === "add"} className="gap-2">
          <Plus aria-hidden="true" /> {busyAction === "add" ? "Criando..." : `Adicionar (${campaigns.length}/10)`}
        </Button>
      </div>

      {message && <p role="status" className="text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

      {campaigns.length === 0 ? (
        <p className="border-y border-slate-200 py-8 text-center text-sm text-slate-500">Nenhum remarketing configurado.</p>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100">
                <CardTitle className="text-base">{campaign.name}</CardTitle>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${campaign.name}`} title="Remover campanha" disabled={busyId === campaign.id} onClick={() => deleteCampaign(campaign)}>
                  <Trash2 aria-hidden="true" className="text-rose-700" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-name-${campaign.id}`}>Nome da campanha</Label>
                    <Input id={`campaign-name-${campaign.id}`} value={campaign.name} maxLength={80} onChange={(event) => updateCampaign(campaign.id, { name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-delay-${campaign.id}`}>Enviar quantos dias após o pagamento?</Label>
                    <Input id={`campaign-delay-${campaign.id}`} type="number" min={1} max={365} step={1} value={campaign.delayDays} onChange={(event) => updateCampaign(campaign.id, { delayDays: Number(event.target.value) })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`campaign-message-${campaign.id}`}>Mensagem</Label>
                  <Textarea id={`campaign-message-${campaign.id}`} rows={4} maxLength={1000} value={campaign.message} onChange={(event) => updateCampaign(campaign.id, { message: event.target.value })} />
                  <p className="text-xs text-slate-500">{campaign.message.length}/1000 caracteres</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-media-${campaign.id}`}>Mídia (opcional)</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label htmlFor={`campaign-media-${campaign.id}`} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Upload aria-hidden="true" className="size-4" /> Enviar imagem ou vídeo
                      </label>
                      <input id={`campaign-media-${campaign.id}`} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => uploadMedia(campaign, event.target.files?.[0])} />
                      <span className="text-xs text-slate-500">{campaign.mediaFileId ? `Mídia ${campaign.mediaType} pronta` : "Nenhuma mídia"}</span>
                    </div>
                  </div>
                  <label className="flex min-h-9 items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={campaign.isActive} onChange={(event) => updateCampaign(campaign.id, { isActive: event.target.checked })} className="size-4 accent-blue-700" />
                    Campanha ativa
                  </label>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <Button type="button" onClick={() => saveCampaign(campaign)} disabled={busyId === campaign.id} className="gap-2 bg-blue-700 text-white hover:bg-blue-800">
                    <Save aria-hidden="true" /> {busyId === campaign.id ? "Salvando..." : "Salvar campanha"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
