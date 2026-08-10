import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const READER_ELEMENT_ID = 'qr-reader';
type FacingMode = 'environment' | 'user';

interface QrScannerProps {
  active: boolean;
  onDecode: (code: string) => void;
}

export function QrScanner({ active, onDecode }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodeRef = useRef(onDecode);
  const facingModeRef = useRef<FacingMode>('environment');
  onDecodeRef.current = onDecode;

  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (mode: FacingMode) => {
    const scanner = new Html5Qrcode(READER_ELEMENT_ID, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
      ],
    });
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: mode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => onDecodeRef.current(decodedText),
        () => {},
      );
      facingModeRef.current = mode;
      setCanSwitchCamera(true);
      setError(null);
    } catch {
      setError('No se pudo acceder a la cámara.');
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    startCamera(facingModeRef.current);

    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      setCanSwitchCamera(false);
      if (!scanner) return;
      try {
        // .stop() lanza sincrónicamente (no devuelve una promesa rechazada)
        // cuando la cámara nunca llegó a iniciar — p. ej. sin permiso de
        // cámara en el entorno. Hay que atajar ambos casos.
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            // cámara ya detenida
          });
      } catch {
        // el scanner nunca llegó a iniciar
      }
    };
  }, [active, startCamera]);

  const handleSwitchCamera = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const nextMode: FacingMode = facingModeRef.current === 'environment' ? 'user' : 'environment';
    try {
      await scanner.stop();
      await scanner.clear();
    } catch {
      // cámara ya detenida
    }
    await startCamera(nextMode);
  };

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div id={READER_ELEMENT_ID} data-testid="qr-reader" className="overflow-hidden ring-1 ring-border" />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {canSwitchCamera && (
        <Button type="button" variant="outline" size="sm" onClick={handleSwitchCamera} data-testid="switch-camera-btn">
          <RefreshCwIcon />
          Girar cámara
        </Button>
      )}
    </div>
  );
}
