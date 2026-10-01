import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendas e Pedidos</h1>
          <p className="text-slate-500">Acompanhe todas as transações realizadas.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Vendas</CardTitle>
          <CardDescription>
            Nenhuma venda registrada ainda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 space-y-4">
            <p className="text-slate-500 text-sm">Quando seus clientes começarem a pagar via Pix, os pedidos aparecerão aqui.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
