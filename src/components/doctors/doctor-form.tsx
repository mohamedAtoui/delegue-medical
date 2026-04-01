"use client";

import { useState, useEffect } from "react";
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
import { Star } from "lucide-react";
import type { Doctor } from "@/types";

interface DoctorFormProps {
  onSuccess: (doctor: Doctor) => void;
  onCancel?: () => void;
  initialData?: Doctor | null;
}

export function DoctorForm({ onSuccess, onCancel, initialData }: DoctorFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    doctor_type: "medecin",
    specialty: "",
    address: "",
    wilaya: "",
    phone: "",
    potentiel: "",
    engagement: 0,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        first_name: initialData.first_name || "",
        last_name: initialData.last_name || "",
        doctor_type: initialData.doctor_type || "medecin",
        specialty: initialData.specialty || "",
        address: initialData.address || "",
        wilaya: initialData.wilaya || "",
        phone: initialData.phone || "",
        potentiel: initialData.potentiel || "",
        engagement: initialData.engagement || 0,
      });
    }
  }, [initialData]);

  const isEdit = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.first_name || !form.last_name || !form.wilaya) {
      toast.error("Prénom, nom et wilaya sont requis");
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/doctors/${initialData.id}` : "/api/doctors";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          potentiel: form.potentiel || null,
          specialty: form.specialty || null,
          phone: form.phone || null,
          address: form.address || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const doctor = await res.json();
      toast.success(isEdit ? "Médecin modifié avec succès" : "Médecin ajouté avec succès");
      onSuccess(doctor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="last_name">Nom *</Label>
          <Input
            id="last_name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            placeholder="Nom"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="first_name">Prénom *</Label>
          <Input
            id="first_name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            placeholder="Prénom"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type *</Label>
          <Select
            value={form.doctor_type}
            onValueChange={(v) => setForm({ ...form, doctor_type: v ?? "medecin" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="medecin">Médecin</SelectItem>
              <SelectItem value="pharmacien">Pharmacien</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Spécialité</Label>
          <Select
            value={form.specialty}
            onValueChange={(v) => setForm({ ...form, specialty: v ?? "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
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
      </div>

      <div className="space-y-2">
        <Label>Wilaya *</Label>
        <WilayaSelect
          value={form.wilaya}
          onValueChange={(v) => setForm({ ...form, wilaya: v })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Adresse cabinet</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder="Adresse du cabinet"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Potentiel</Label>
          <Select
            value={form.potentiel}
            onValueChange={(v) => setForm({ ...form, potentiel: v ?? "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A - Fort</SelectItem>
              <SelectItem value="B">B - Moyen</SelectItem>
              <SelectItem value="C">C - Faible</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Engagement avec le labo</Label>
          <div className="flex items-center gap-1 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setForm({ ...form, engagement: star })}
                className="cursor-pointer"
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    star <= form.engagement
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "En cours..." : isEdit ? "Modifier" : "Ajouter le médecin"}
        </Button>
      </div>
    </form>
  );
}
