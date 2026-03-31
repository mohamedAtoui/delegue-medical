"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { toast } from "sonner";
import type { Doctor } from "@/types";

interface DoctorFormProps {
  onSuccess: (doctor: Doctor) => void;
  onCancel?: () => void;
}

export function DoctorForm({ onSuccess, onCancel }: DoctorFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    specialty: "",
    wilaya: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.first_name || !form.last_name || !form.wilaya) {
      toast.error("Prénom, nom et wilaya sont requis");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const doctor = await res.json();
      toast.success("Médecin ajouté avec succès");
      onSuccess(doctor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">Prénom *</Label>
          <Input
            id="first_name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            placeholder="Prénom du médecin"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Nom *</Label>
          <Input
            id="last_name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            placeholder="Nom du médecin"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Spécialité</Label>
        <Select
          value={form.specialty}
          onValueChange={(v) => setForm({ ...form, specialty: v ?? "" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une spécialité" />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTIES.map((spec) => (
              <SelectItem key={spec} value={spec}>
                {spec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Wilaya *</Label>
        <WilayaSelect
          value={form.wilaya}
          onValueChange={(v) => setForm({ ...form, wilaya: v })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Téléphone</Label>
        <Input
          id="phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Numéro de téléphone"
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Ajout en cours..." : "Ajouter le médecin"}
        </Button>
      </div>
    </form>
  );
}
