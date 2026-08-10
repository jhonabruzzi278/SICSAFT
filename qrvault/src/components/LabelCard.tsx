import { useMemo } from 'react';
import qrcodeGenerator from 'qrcode-generator';
import { cn } from '@/lib/utils';
import type { LabelUnit } from '@/lib/labels';

interface LabelCardProps {
  unit: LabelUnit;
  className?: string;
}

export function LabelCard({ unit, className }: LabelCardProps) {
  const qrSvg = useMemo(() => {
    const qr = qrcodeGenerator(0, 'M');
    qr.addData(unit.printCode);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2 });
  }, [unit.printCode]);

  return (
    <div data-testid="print-label" className={cn('bg-secondary p-4 text-center', className)}>
      {/* qrSvg viene de qrcode-generator a partir de unit.printCode (código interno), no de HTML/input de usuario. */}
      <div
        data-testid="print-label-qr"
        className="mx-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-32"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="mt-2 text-sm font-bold" data-testid="print-label-title">
        {unit.title}
      </div>
      {unit.priceText && (
        <div className="text-base font-bold text-brand" data-testid="print-label-price">
          {unit.priceText}
        </div>
      )}
      <div className="mt-1 text-xs text-muted-foreground" data-testid="print-label-code">
        {unit.printCode}
      </div>
    </div>
  );
}
