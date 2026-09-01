import { ConvectionOrder } from '../types';

export interface OrderItemLine {
  id: string;
  name: string;
  size: string;
  sleeve: 'Pendek' | 'Panjang' | 'Custom / Tanpa Lengan';
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isAddon?: boolean;
}

export interface OrderBreakdownResult {
  lines: OrderItemLine[];
  totalQty: number;
  subtotal: number;
  basePrice: number;
  effShortXXL: number;
  effLongStandard: number;
  effLongXXL: number;
  effCustomDefault: number;
  pricePerVariant: {
    label: string;
    sleeve: 'Pendek' | 'Panjang' | '-';
    price: number;
  }[];
}

export function getEffectivePrice(addVal: number | undefined, defaultBase: number = 0): number {
  if (addVal === undefined || addVal === null || addVal === 0) return defaultBase;
  if (addVal < 0) return Math.max(0, defaultBase + addVal);
  if (defaultBase > 0 && addVal < defaultBase / 2) {
    return defaultBase + addVal;
  }
  return addVal;
}

export function calculateOrderBreakdown(order: ConvectionOrder): OrderBreakdownResult {
  const basePrice = Number(order.unitPrice) || 0;

  const effShortXXL = getEffectivePrice(order.addPriceXXL, basePrice);
  const deltaXXL = effShortXXL - basePrice;

  const effLongStandard = getEffectivePrice(order.addPriceLongSleeve, basePrice);
  const deltaLong = effLongStandard > basePrice ? effLongStandard - basePrice : 0;

  const rawLongXXL = order.addPriceLongSleeveXXL || 0;
  const effLongXXL = rawLongXXL !== 0
    ? getEffectivePrice(rawLongXXL, effShortXXL)
    : (effShortXXL + deltaLong);

  const effCustomDefault = getEffectivePrice(order.addPriceCustom, basePrice);

  const lines: OrderItemLine[] = [];
  const pricePerVariant: { label: string; sleeve: 'Pendek' | 'Panjang' | '-'; price: number }[] = [];

  const hasDetailedSleeve =
    order.sizeS_short !== undefined || order.sizeS_long !== undefined ||
    order.sizeM_short !== undefined || order.sizeM_long !== undefined ||
    order.sizeL_short !== undefined || order.sizeL_long !== undefined ||
    order.sizeXL_short !== undefined || order.sizeXL_long !== undefined ||
    order.sizeXXL_short !== undefined || order.sizeXXL_long !== undefined;

  const stdSizes = [
    { key: 'S', short: order.sizeS_short ?? (hasDetailedSleeve ? 0 : (order.lenganPanjang ? 0 : order.sizeS || 0)), long: order.sizeS_long ?? 0 },
    { key: 'M', short: order.sizeM_short ?? (hasDetailedSleeve ? 0 : (order.lenganPanjang ? 0 : order.sizeM || 0)), long: order.sizeM_long ?? 0 },
    { key: 'L', short: order.sizeL_short ?? (hasDetailedSleeve ? 0 : (order.lenganPanjang ? 0 : order.sizeL || 0)), long: order.sizeL_long ?? 0 },
    { key: 'XL', short: order.sizeXL_short ?? (hasDetailedSleeve ? 0 : (order.lenganPanjang ? 0 : order.sizeXL || 0)), long: order.sizeXL_long ?? 0 },
  ];

  if (hasDetailedSleeve) {
    // 1. Standard Short
    stdSizes.forEach(s => {
      const q = Number(s.short) || 0;
      if (q > 0) {
        lines.push({
          id: `std-short-${s.key}`,
          name: `${order.productType} (Ukuran ${s.key})`,
          size: s.key,
          sleeve: 'Pendek',
          quantity: q,
          unitPrice: basePrice,
          subtotal: q * basePrice,
        });
      }
    });

    // 2. Standard Long
    stdSizes.forEach(s => {
      const q = Number(s.long) || 0;
      if (q > 0) {
        lines.push({
          id: `std-long-${s.key}`,
          name: `${order.productType} (Ukuran ${s.key})`,
          size: s.key,
          sleeve: 'Panjang',
          quantity: q,
          unitPrice: effLongStandard,
          subtotal: q * effLongStandard,
        });
      }
    });

    // 3. XXL Short
    const xxlShort = Number(order.sizeXXL_short) || 0;
    if (xxlShort > 0) {
      lines.push({
        id: 'xxl-short',
        name: `${order.productType} (Ukuran XXL)`,
        size: 'XXL',
        sleeve: 'Pendek',
        quantity: xxlShort,
        unitPrice: effShortXXL,
        subtotal: xxlShort * effShortXXL,
      });
    }

    // 4. XXL Long
    const xxlLong = Number(order.sizeXXL_long) || 0;
    if (xxlLong > 0) {
      lines.push({
        id: 'xxl-long',
        name: `${order.productType} (Ukuran XXL)`,
        size: 'XXL',
        sleeve: 'Panjang',
        quantity: xxlLong,
        unitPrice: effLongXXL,
        subtotal: xxlLong * effLongXXL,
      });
    }
  } else {
    // Legacy fallback
    const lk = Number(order.lenganPendek) || 0;
    const lp = Number(order.lenganPanjang) || 0;
    const xxlQty = Number(order.sizeXXL) || 0;

    if (lp === 0 && lk === 0) {
      ['S', 'M', 'L', 'XL'].forEach(sz => {
        const q = Number(order[`size${sz}` as keyof ConvectionOrder]) || 0;
        if (q > 0) {
          lines.push({
            id: `legacy-${sz}`,
            name: `${order.productType} (Ukuran ${sz})`,
            size: sz,
            sleeve: 'Pendek',
            quantity: q,
            unitPrice: basePrice,
            subtotal: q * basePrice,
          });
        }
      });
      if (xxlQty > 0) {
        lines.push({
          id: 'legacy-xxl',
          name: `${order.productType} (Ukuran XXL)`,
          size: 'XXL',
          sleeve: 'Pendek',
          quantity: xxlQty,
          unitPrice: effShortXXL,
          subtotal: xxlQty * effShortXXL,
        });
      }
    } else {
      if (lk > 0) {
        lines.push({
          id: 'legacy-short-total',
          name: `${order.productType} (Lengan Pendek)`,
          size: 'S - XL',
          sleeve: 'Pendek',
          quantity: lk,
          unitPrice: basePrice,
          subtotal: lk * basePrice,
        });
      }
      if (lp > 0) {
        lines.push({
          id: 'legacy-long-total',
          name: `${order.productType} (Lengan Panjang)`,
          size: 'S - XL',
          sleeve: 'Panjang',
          quantity: lp,
          unitPrice: effLongStandard,
          subtotal: lp * effLongStandard,
        });
      }
      if (xxlQty > 0) {
        lines.push({
          id: 'legacy-xxl-total',
          name: `${order.productType} (Ukuran XXL)`,
          size: 'XXL',
          sleeve: lp > 0 && lk === 0 ? 'Panjang' : 'Pendek',
          quantity: xxlQty,
          unitPrice: lp > 0 && lk === 0 ? effLongXXL : effShortXXL,
          subtotal: xxlQty * (lp > 0 && lk === 0 ? effLongXXL : effShortXXL),
        });
      }
    }
  }

  // 5. Custom Sizes
  if (order.customSizes && order.customSizes.length > 0) {
    order.customSizes.forEach((cs, idx) => {
      const csName = cs.name?.trim() || `Custom ${idx + 1}`;
      const csShort = Number(cs.short) || 0;
      const csLong = Number(cs.long) || 0;

      const pShort = (cs.priceShort !== undefined && cs.priceShort !== 0)
        ? getEffectivePrice(cs.priceShort, basePrice)
        : effCustomDefault;

      const pLong = (cs.priceLong !== undefined && cs.priceLong !== 0)
        ? getEffectivePrice(cs.priceLong, basePrice + deltaLong)
        : (pShort + deltaLong);

      if (csShort > 0) {
        lines.push({
          id: `custom-${idx}-short`,
          name: `${order.productType} (Ukuran ${csName})`,
          size: csName,
          sleeve: 'Pendek',
          quantity: csShort,
          unitPrice: pShort,
          subtotal: csShort * pShort,
        });
      }

      if (csLong > 0) {
        lines.push({
          id: `custom-${idx}-long`,
          name: `${order.productType} (Ukuran ${csName})`,
          size: csName,
          sleeve: 'Panjang',
          quantity: csLong,
          unitPrice: pLong,
          subtotal: csLong * pLong,
        });
      }
    });
  } else if (order.sizeCustom) {
    const currentQtySum = lines.reduce((s, l) => s + l.quantity, 0);
    const customQty = Math.max(0, (Number(order.quantity) || 0) - currentQtySum);
    if (customQty > 0) {
      lines.push({
        id: 'legacy-custom-str',
        name: `${order.productType} (${order.sizeCustom})`,
        size: order.sizeCustom,
        sleeve: 'Custom / Tanpa Lengan',
        quantity: customQty,
        unitPrice: effCustomDefault,
        subtotal: customQty * effCustomDefault,
      });
    }
  }

  // Fallback if no lines were generated
  if (lines.length === 0 && (order.quantity || 0) > 0) {
    lines.push({
      id: 'fallback-item',
      name: order.productType,
      size: 'All Size',
      sleeve: 'Pendek',
      quantity: Number(order.quantity) || 1,
      unitPrice: basePrice,
      subtotal: (Number(order.quantity) || 1) * basePrice,
    });
  }

  // Price rates summary
  pricePerVariant.push({ label: 'Standar (S-XL)', sleeve: 'Pendek', price: basePrice });
  if (effLongStandard !== basePrice || order.lenganPanjang || lines.some(l => l.sleeve === 'Panjang')) {
    pricePerVariant.push({ label: 'Standar (S-XL)', sleeve: 'Panjang', price: effLongStandard });
  }
  if (effShortXXL !== basePrice || order.sizeXXL > 0 || (order.sizeXXL_short || 0) > 0) {
    pricePerVariant.push({ label: 'Ukuran XXL', sleeve: 'Pendek', price: effShortXXL });
  }
  if (effLongXXL !== basePrice || (order.sizeXXL_long || 0) > 0) {
    pricePerVariant.push({ label: 'Ukuran XXL', sleeve: 'Panjang', price: effLongXXL });
  }

  if (order.customSizes && order.customSizes.length > 0) {
    order.customSizes.forEach((cs, idx) => {
      const csName = cs.name?.trim() || `Custom ${idx + 1}`;
      const pShort = (cs.priceShort !== undefined && cs.priceShort !== 0) ? getEffectivePrice(cs.priceShort, basePrice) : effCustomDefault;
      const pLong = (cs.priceLong !== undefined && cs.priceLong !== 0) ? getEffectivePrice(cs.priceLong, basePrice + deltaLong) : (pShort + deltaLong);
      if ((cs.short || 0) > 0 || cs.priceShort) {
        pricePerVariant.push({ label: `Ukuran ${csName}`, sleeve: 'Pendek', price: pShort });
      }
      if ((cs.long || 0) > 0 || cs.priceLong) {
        pricePerVariant.push({ label: `Ukuran ${csName}`, sleeve: 'Panjang', price: pLong });
      }
    });
  }

  const totalQty = lines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = lines.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    lines,
    totalQty,
    subtotal,
    basePrice,
    effShortXXL,
    effLongStandard,
    effLongXXL,
    effCustomDefault,
    pricePerVariant,
  };
}
