"use client";

import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product } from "@/types";

interface ProductSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function ProductSelect({ value, onValueChange }: ProductSelectProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Stable refs let us fire the auto-select side-effect from a mount-only
  // effect without re-fetching whenever the parent re-renders with a new
  // callback identity.
  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => {
    valueRef.current = value;
    onValueChangeRef.current = onValueChange;
  });

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoaded(true);
        if (data.length === 1 && !valueRef.current) {
          onValueChangeRef.current(data[0].id);
        }
      });
  }, []);

  const selectedName = products.find((p) => p.id === value)?.name;

  if (!loaded) {
    return (
      <div className="h-8 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Sélectionner un produit">
          {selectedName || "Sélectionner un produit"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {products.map((product) => (
          <SelectItem key={product.id} value={product.id}>
            {product.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
