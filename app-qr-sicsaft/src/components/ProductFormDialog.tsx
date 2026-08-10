import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImageIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fileToCompressedDataUrl } from '@/lib/image';
import type { Product, ProductVariant } from '@/lib/db';

const variantSchema = z.object({
  code: z.string().trim().min(1, 'Cada variante necesita un código'),
  name: z.string().trim(),
  stock: z.coerce.number().min(0),
});

const productFormSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio'),
    code: z.string().trim().min(1, 'El código es obligatorio'),
    description: z.string().trim(),
    category: z.string().trim(),
    unitType: z.enum(['unitario', 'peso', 'volumen']),
    hasIva: z.boolean(),
    ivaPercent: z.coerce.number().min(0).max(100),
    priceWithoutTax: z.coerce.number().min(0),
    finalPrice: z.coerce.number().min(0),
    stock: z.coerce.number().min(0),
    minStock: z.coerce.number().min(0),
    variants: z.array(variantSchema),
    image: z.string(),
  })
  .refine(
    (data) => {
      const codes = data.variants.map((v) => v.code.trim().toUpperCase());
      return new Set(codes).size === codes.length;
    },
    { message: 'Los códigos de variante deben ser únicos', path: ['variants'] },
  );

export type ProductFormValues = z.infer<typeof productFormSchema>;

const DEFAULT_VALUES: ProductFormValues = {
  name: '',
  code: '',
  description: '',
  category: '',
  unitType: 'unitario',
  hasIva: false,
  ivaPercent: 21,
  priceWithoutTax: 0,
  finalPrice: 0,
  stock: 0,
  minStock: 5,
  variants: [],
  image: '',
};

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function productToValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    code: product.code,
    description: product.description ?? '',
    category: product.category ?? '',
    unitType: product.unitType ?? 'unitario',
    hasIva: product.hasIva ?? false,
    ivaPercent: product.ivaPercent ?? 21,
    priceWithoutTax: product.priceWithoutTax ?? 0,
    finalPrice: product.finalPrice ?? 0,
    stock: product.stock ?? 0,
    minStock: product.minStock ?? 0,
    variants: (product.variants ?? []).map((v) => ({ code: v.code, name: v.name, stock: v.stock })),
    image: product.image ?? '',
  };
}

export function valuesToProduct(values: ProductFormValues, existing?: Product | null): Product {
  const variants: ProductVariant[] = values.variants.map((v) => ({
    code: v.code.trim().toUpperCase(),
    name: v.name.trim(),
    stock: v.stock,
  }));

  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category.trim(),
    unitType: values.unitType,
    hasIva: values.hasIva,
    ivaPercent: values.hasIva ? values.ivaPercent : 0,
    priceWithoutTax: values.hasIva ? values.priceWithoutTax : values.finalPrice,
    finalPrice: values.finalPrice,
    stock: variants.length > 0 ? variants.reduce((sum, v) => sum + v.stock, 0) : values.stock,
    minStock: values.minStock,
    variants,
    image: values.image || undefined,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

interface ProductFormDialogProps {
  open: boolean;
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (product: Product) => Promise<{ duplicateCode?: boolean }>;
}

export function ProductFormDialog({ open, product, onOpenChange, onSubmit }: ProductFormDialogProps) {
  const isEdit = product !== null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageProcessing, setImageProcessing] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' });

  useEffect(() => {
    if (!open) return;
    form.reset(product ? productToValues(product) : DEFAULT_VALUES);
    // Sólo debe reiniciarse al abrir el diálogo, no en cada re-render mientras
    // el usuario está completando el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.code]);

  const hasIva = form.watch('hasIva');
  const ivaPercent = form.watch('ivaPercent');
  const hasVariants = fields.length > 0;

  function recalcFromPriceNoTax(nextPriceNoTax: number) {
    form.setValue('priceWithoutTax', nextPriceNoTax);
    form.setValue('finalPrice', round2(nextPriceNoTax * (1 + (Number(ivaPercent) || 0) / 100)));
  }

  function recalcFromFinalPrice(nextFinalPrice: number) {
    form.setValue('finalPrice', nextFinalPrice);
    form.setValue('priceWithoutTax', round2(nextFinalPrice / (1 + (Number(ivaPercent) || 0) / 100)));
  }

  function recalcFromIvaPercent(nextIva: number) {
    form.setValue('ivaPercent', nextIva);
    form.setValue('finalPrice', round2((Number(form.getValues('priceWithoutTax')) || 0) * (1 + nextIva / 100)));
  }

  async function handleSubmit(values: ProductFormValues) {
    const built = valuesToProduct(values, product);
    const result = await onSubmit(built);
    if (result.duplicateCode) {
      form.setError('code', { message: 'Este código ya existe' });
      return;
    }
    onOpenChange(false);
  }

  async function handleImageSelect(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setImageProcessing(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      form.setValue('image', dataUrl, { shouldDirty: true });
    } finally {
      setImageProcessing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="product-modal" className="max-h-[90vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 pb-1">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del producto</FormLabel>
                      <FormControl>
                        <Input data-testid="pf-name" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código único</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="pf-code"
                          autoComplete="off"
                          className="uppercase"
                          disabled={isEdit}
                          {...field}
                        />
                      </FormControl>
                      {isEdit && (
                        <FormDescription>El código no se puede modificar una vez creado.</FormDescription>
                      )}
                      <FormMessage data-testid="pf-code-error" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Foto del producto (opcional)</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap items-center gap-3">
                          {field.value ? (
                            <img
                              src={field.value}
                              alt="Vista previa"
                              data-testid="pf-image-preview"
                              className="h-20 w-20 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                              <ImageIcon />
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={imageProcessing}
                              onClick={() => fileInputRef.current?.click()}
                              data-testid="pf-image-upload-btn"
                            >
                              <UploadIcon />
                              {imageProcessing ? 'Procesando...' : field.value ? 'Cambiar foto' : 'Subir foto'}
                            </Button>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => form.setValue('image', '', { shouldDirty: true })}
                                data-testid="pf-image-remove-btn"
                              >
                                <Trash2Icon />
                                Quitar foto
                              </Button>
                            )}
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            data-testid="pf-image-input"
                            onChange={(e) => {
                              handleImageSelect(e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción del producto (opcional)</FormLabel>
                      <FormControl>
                        <Textarea data-testid="pf-description" rows={2} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría (opcional)</FormLabel>
                      <FormControl>
                        <Input data-testid="pf-category" placeholder="Ej. Bebidas, Accesorios..." autoComplete="off" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unitType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de unidad</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="pf-unit-type" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unitario">Unitario</SelectItem>
                          <SelectItem value="peso">Peso (kg)</SelectItem>
                          <SelectItem value="volumen">Volumen (L)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hasIva"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-3">
                        <FormControl>
                          <Switch data-testid="pf-has-iva" checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mb-0">Incluye IVA</FormLabel>
                      </div>
                      <FormDescription>Activá si el producto tiene IVA diferenciado del precio final.</FormDescription>
                    </FormItem>
                  )}
                />

                {hasIva && (
                  <div data-testid="pf-iva-fields" className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="ivaPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IVA %</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="pf-iva-percent"
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              {...field}
                              onChange={(e) => recalcFromIvaPercent(e.target.valueAsNumber || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priceWithoutTax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio sin impuestos</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="pf-price-no-tax"
                              type="number"
                              min={0}
                              step="0.01"
                              {...field}
                              onChange={(e) => recalcFromPriceNoTax(e.target.valueAsNumber || 0)}
                            />
                          </FormControl>
                          <FormDescription>Corresponde al precio por unidad sin impuestos.</FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="finalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio final</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="pf-final-price"
                          type="number"
                          min={0}
                          step="0.01"
                          {...field}
                          onChange={(e) =>
                            hasIva ? recalcFromFinalPrice(e.target.valueAsNumber || 0) : field.onChange(e.target.valueAsNumber || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>Corresponde al precio por unidad final.</FormDescription>
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="pf-stock"
                            type="number"
                            min={0}
                            step="1"
                            disabled={hasVariants}
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          />
                        </FormControl>
                        <FormDescription data-testid="pf-stock-hint">
                          {hasVariants ? 'El stock se gestiona por variante.' : 'Usá la unidad real (u) para el stock disponible.'}
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alerta de stock bajo</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="pf-min-stock"
                            type="number"
                            min={0}
                            step="1"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide uppercase">Variantes / Talles</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="pf-add-variant"
                      onClick={() => append({ code: '', name: '', stock: 0 })}
                    >
                      <PlusIcon />
                      Agregar variante
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Usá variantes para manejar talles, colores o presentaciones con stock propio. El precio se
                    mantiene igual para todas.
                  </p>
                  {!hasVariants && (
                    <p className="text-sm text-muted-foreground" data-testid="pf-no-variants">
                      Sin variantes. El stock se gestiona desde el campo de stock principal.
                    </p>
                  )}
                  {fields.length > 0 && (
                    <div className="space-y-2" data-testid="pf-variants-list">
                      {fields.map((fieldItem, index) => (
                        <div key={fieldItem.id} className="flex flex-wrap items-center gap-2">
                          <FormField
                            control={form.control}
                            name={`variants.${index}.code`}
                            render={({ field }) => (
                              <Input
                                data-testid="pf-variant-code"
                                aria-label="Código de variante"
                                className="w-20 shrink-0 uppercase"
                                placeholder="Código"
                                {...field}
                              />
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.name`}
                            render={({ field }) => (
                              <Input
                                data-testid="pf-variant-name"
                                aria-label="Nombre de variante"
                                className="min-w-[8rem] flex-1"
                                placeholder="Nombre (opcional)"
                                {...field}
                              />
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`variants.${index}.stock`}
                            render={({ field }) => (
                              <Input
                                data-testid="pf-variant-stock"
                                aria-label="Stock de variante"
                                className="w-20 shrink-0"
                                type="number"
                                min={0}
                                step="1"
                                {...field}
                                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                              />
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
                            aria-label="Quitar variante"
                            data-testid="pf-variant-remove"
                            onClick={() => remove(index)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      ))}
                      {(form.formState.errors.variants?.root?.message || form.formState.errors.variants?.message) && (
                        <p data-testid="pf-form-error" className="text-sm text-destructive" role="alert">
                          {form.formState.errors.variants?.root?.message ?? form.formState.errors.variants?.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="pf-cancel">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" data-testid="pf-submit">
                {isEdit ? 'Guardar Cambios' : 'Crear Producto'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
