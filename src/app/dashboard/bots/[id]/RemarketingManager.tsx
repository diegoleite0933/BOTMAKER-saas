"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Campaign = {
  id: string;
  name: string;
  delayDays?: number | null;
  delayMinutes: number;
  message: string | null;
  targetProductId: string | null;
  discountPercent: number;
  mediaFileId: string | null;
  mediaType: string | null;
  isActive: boolean;
};

type OfferOption = { id: string; name: string; price: number; discountPercent: number; kind: string };

export function RemarketingManager({ botId, availableOffers, initialCampaigns }: { botId: string; availableOffers: OfferOption[]; initialCampaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(initialCampaigns[0]?.id || null);
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
        body: JSON.stringify({ botId, name: `Remarketing ${campaigns.length + 1}`, delayMinutes: 60, message: "", targetProductId: null, discountPercent: 0, mediaFileId: "", mediaType: null, isActive: false }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível criar o remarketing.");
      setCampaigns((current) => [...current, result.campaign]);
      setOpenCampaignId(result.campaign.id);
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
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Envie mensagens após o início do bot. O remarketing é interrompido quando o cliente paga, e cada etapa é enviada uma vez.</p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <span className="text-sm text-slate-500">{campaigns.length}/10 etapas</span>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Adicionar remarketing" title="Adicionar remarketing" onClick={addCampaign} disabled={campaigns.length >= 10 || busyAction === "add"}>
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>

      {message && <p role="status" className="text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

      {campaigns.length === 0 ? (
        <p className="border-y border-slate-200 py-8 text-center text-sm text-slate-500">Nenhum remarketing configurado.</p>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="rounded-lg">
              <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  aria-expanded={openCampaignId === campaign.id}
                  aria-controls={`campaign-settings-${campaign.id}`}
                  onClick={() => setOpenCampaignId((current) => current === campaign.id ? null : campaign.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 transition-transform ${openCampaignId === campaign.id ? "rotate-180" : ""}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 sm:text-base">{campaign.name}</span>
                  <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{campaign.delayMinutes} min</span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${campaign.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {campaign.isActive ? "Ativo" : "Rascunho"}
                  </span>
                </button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${campaign.name}`} title="Remover campanha" disabled={busyId === campaign.id} onClick={() => deleteCampaign(campaign)}>
                  <Trash2 aria-hidden="true" className="text-rose-700" />
                </Button>
              </div>
              {openCampaignId === campaign.id && <CardContent id={`campaign-settings-${campaign.id}`} className="space-y-5 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-name-${campaign.id}`}>Nome da campanha</Label>
                    <Input id={`campaign-name-${campaign.id}`} value={campaign.name} maxLength={80} onChange={(event) => updateCampaign(campaign.id, { name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-delay-${campaign.id}`}>Enviar quantos minutos após iniciar o bot?</Label>
                    <Input id={`campaign-delay-${campaign.id}`} type="number" min={1} max={525600} step={1} value={campaign.delayMinutes} onChange={(event) => updateCampaign(campaign.id, { delayMinutes: Number(event.target.value) })} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-offer-${campaign.id}`}>Oferta com desconto</Label>
                    <select
                      id={`campaign-offer-${campaign.id}`}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={campaign.targetProductId || ""}
                      onChange={(event) => updateCampaign(campaign.id, { targetProductId: event.target.value || null, discountPercent: event.target.value ? campaign.discountPercent : 0 })}
                    >
                      <option value="">Sem oferta de desconto</option>
                      {availableOffers.map((offer) => (
                        <option key={offer.id} value={offer.id}>{offer.kind}: {offer.name} · {offer.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`campaign-discount-${campaign.id}`}>Desconto da oferta (%)</Label>
                    <Input
                      id={`campaign-discount-${campaign.id}`}
                      type="number"
                      min={campaign.targetProductId ? 1 : 0}
                      max={90}
                      step={1}
                      value={campaign.discountPercent}
                      disabled={!campaign.targetProductId}
                      onChange={(event) => updateCampaign(campaign.id, { discountPercent: Number(event.target.value) })}
                    />
                    <p className="text-xs text-slate-500">O cliente recebe um botão individual para abrir a oferta com o desconto aplicado no PIX.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`campaign-message-${campaign.id}`}>Mensagem</Label>
                  <Textarea id={`campaign-message-${campaign.id}`} rows={4} maxLength={1000} value={campaign.message || ""} onChange={(event) => updateCampaign(campaign.id, { message: event.target.value })} />
                  <p className="text-xs text-slate-500">{(campaign.message || "").length}/1000 caracteres</p>
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

                {campaign.mediaFileId && campaign.mediaType && (
                  <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-start">
                    {campaign.mediaType === "video" ? (
                      <video controls playsInline className="max-h-64 w-full rounded-md bg-black sm:max-w-sm" src={`/api/bots/media/${botId}?fileId=${encodeURIComponent(campaign.mediaFileId)}`} />
                    ) : (
                      <Image unoptimized width={480} height={320} alt={`Mídia de ${campaign.name}`} className="max-h-64 w-full rounded-md object-contain sm:max-w-sm" src={`/api/bots/media/${botId}?fileId=${encodeURIComponent(campaign.mediaFileId)}`} />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Remover mídia de ${campaign.name}`}
                      title="Remover mídia"
                      onClick={() => updateCampaign(campaign.id, { mediaFileId: null, mediaType: null })}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                )}

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <Button type="button" onClick={() => saveCampaign(campaign)} disabled={busyId === campaign.id} className="gap-2 bg-blue-700 text-white hover:bg-blue-800">
                    <Save aria-hidden="true" /> {busyId === campaign.id ? "Salvando..." : "Salvar campanha"}
                  </Button>
                </div>
              </CardContent>}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
