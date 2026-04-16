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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Star, Stethoscope, Pill, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor, DoctorType } from "@/types";

interface DoctorFormProps {
  onSuccess: (doctor: Doctor) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  initialData?: Doctor | null;
  defaultType?: DoctorType;
  userRole?: string;
}

export function DoctorForm({ onSuccess, onCancel, onDelete, initialData, defaultType, userRole }: DoctorFormProps) {
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    doctor_type: (defaultType || "medecin") as DoctorType,
    specialty: "",
    address: "",
    google_maps_url: "",
    wilaya: "",
    phone_fixe: "",
    phone_mobile: "",
    email: "",
    grossiste_pharma: "",
    grossiste_para_pharm: "",
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
        google_maps_url: initialData.google_maps_url || "",
        wilaya: initialData.wilaya || "",
        phone_fixe: initialData.phone_fixe || "",
        phone_mobile: initialData.phone_mobile || initialData.phone || "",
        email: initialData.email || "",
        grossiste_pharma: initialData.grossiste_pharma || "",
        grossiste_para_pharm: initialData.grossiste_para_pharm || "",
        potentiel: initialData.potentiel || "",
        engagement: initialData.engagement || 0,
      });
    }
  }, [initialData]);

  const isEdit = !!initialData;
  const isPharmacien = form.doctor_type === "pharmacien";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Common required
    if (!form.first_name || !form.last_name || !form.wilaya) {
      toast.error("Nom, prénom et wilaya sont requis");
      return;
    }
    if (!form.address) {
      toast.error("L'adresse est requise");
      return;
    }
    if (!form.phone_fixe) {
      toast.error("Le téléphone fixe est requis");
      return;
    }
    // Médecin-specific
    if (!isPharmacien && !form.specialty) {
      toast.error("La spécialité est requise pour un médecin");
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
          specialty: isPharmacien ? null : (form.specialty || null),
          phone_fixe: form.phone_fixe || null,
          phone_mobile: form.phone_mobile || null,
          email: form.email || null,
          address: form.address || null,
          google_maps_url: form.google_maps_url || null,
          grossiste_pharma: isPharmacien ? (form.grossiste_pharma || null) : null,
          grossiste_para_pharm: isPharmacien ? (form.grossiste_para_pharm || null) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const doctor = await res.json();
      toast.success(
        isEdit
          ? `${isPharmacien ? "Pharmacien" : "Médecin"} modifié avec succès`
          : `${isPharmacien ? "Pharmacien" : "Médecin"} ajouté avec succès`
      );
      onSuccess(doctor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector */}
      <div className="space-y-2">
        <Label>Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, doctor_type: "medecin" })}
            className={cn(
              "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
              form.doctor_type === "medecin"
                ? "border-primary bg-primary/5 text-primary font-semibold"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            <Stethoscope className="h-5 w-5" />
            Médecin
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, doctor_type: "pharmacien" })}
            className={cn(
              "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
              form.doctor_type === "pharmacien"
                ? "border-accent bg-accent/5 text-accent font-semibold"
                : "border-border text-muted-foreground hover:border-accent/40"
            )}
          >
            <Pill className="h-5 w-5" />
            Pharmacien
          </button>
        </div>
      </div>

      {/* Names */}
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

      {/* Spécialité — médecin only */}
      {!isPharmacien && (
        <div className="space-y-2">
          <Label>Spécialité *</Label>
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
      )}

      {/* Wilaya */}
      <div className="space-y-2">
        <Label>Wilaya *</Label>
        <WilayaSelect
          value={form.wilaya}
          onValueChange={(v) => setForm({ ...form, wilaya: v })}
        />
      </div>

      {/* Adresse */}
      <div className="space-y-2">
        <Label htmlFor="address">
          {isPharmacien ? "Adresse *" : "Adresse cabinet *"}
        </Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder={isPharmacien ? "Adresse de la pharmacie" : "Adresse du cabinet"}
        />
      </div>

      {/* Google Maps link */}
      <div className="space-y-2">
        <Label htmlFor="google_maps_url">Lien Google Maps</Label>
        <Input
          id="google_maps_url"
          value={form.google_maps_url}
          onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
          placeholder="https://maps.google.com/..."
          type="url"
        />
      </div>

      {/* Phones */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone_fixe">Téléphone fixe *</Label>
          <Input
            id="phone_fixe"
            value={form.phone_fixe}
            onChange={(e) => setForm({ ...form, phone_fixe: e.target.value })}
            placeholder="021 XX XX XX"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone_mobile">Téléphone portable</Label>
          <Input
            id="phone_mobile"
            value={form.phone_mobile}
            onChange={(e) => setForm({ ...form, phone_mobile: e.target.value })}
            placeholder="0555 XX XX XX"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="contact@exemple.com"
          type="email"
        />
      </div>

      {/* Potentiel + engagement */}
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

      {/* Pharmacien-specific */}
      {isPharmacien && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grossiste_pharma">Grossiste Pharma</Label>
            <Input
              id="grossiste_pharma"
              value={form.grossiste_pharma}
              onChange={(e) => setForm({ ...form, grossiste_pharma: e.target.value })}
              placeholder="Nom du grossiste"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grossiste_para_pharm">Grossiste Para-Pharm</Label>
            <Input
              id="grossiste_para_pharm"
              value={form.grossiste_para_pharm}
              onChange={(e) => setForm({ ...form, grossiste_para_pharm: e.target.value })}
              placeholder="Nom du grossiste"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="cursor-pointer">
            Annuler
          </Button>
        )}
        <Button type="submit" disabled={loading} className="cursor-pointer">
          {loading
            ? "En cours..."
            : isEdit
            ? "Modifier"
            : `Ajouter le ${isPharmacien ? "pharmacien" : "médecin"}`}
        </Button>
      </div>

      {/* Danger zone — supervisor only, edit mode only */}
      {isEdit && userRole === "superviseur" && initialData && (
        <>
          <Separator className="my-6" />
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-semibold text-red-800">Zone dangereuse</h3>
            </div>
            <p className="text-xs text-red-700/80">
              Supprimer {isPharmacien ? "ce pharmacien" : "ce médecin"} ainsi que toutes ses visites,
              commentaires et planifications. Cette action est irréversible.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteConfirmText("");
                setShowDeleteDialog(true);
              }}
              className="cursor-pointer border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Supprimer définitivement
            </Button>
          </div>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-700">
                  Supprimer {isPharmacien ? "" : "Dr. "}
                  {initialData.last_name} {initialData.first_name} ?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <span className="block">
                    Cette action est irréversible. Toutes les visites, commentaires et
                    planifications associées seront définitivement supprimées.
                  </span>
                  <span className="block text-sm font-medium text-foreground">
                    Tapez{" "}
                    <span className="font-mono text-red-600">
                      supprimer {isPharmacien ? "" : "Dr. "}
                      {initialData.last_name} {initialData.first_name}
                    </span>
                    {" "}pour confirmer :
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={`supprimer ${isPharmacien ? "" : "Dr. "}${initialData.last_name} ${initialData.first_name}`}
                className="font-mono text-sm"
              />
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">Annuler</AlertDialogCancel>
                <AlertDialogAction
                  disabled={
                    deleting ||
                    deleteConfirmText.trim().toLowerCase() !==
                      `supprimer ${isPharmacien ? "" : "dr. "}${initialData.last_name} ${initialData.first_name}`.toLowerCase()
                  }
                  onClick={async (e) => {
                    e.preventDefault();
                    setDeleting(true);
                    try {
                      const res = await fetch(`/api/doctors/${initialData.id}`, {
                        method: "DELETE",
                      });
                      if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error);
                      }
                      toast.success(
                        `${isPharmacien ? "Pharmacien" : "Médecin"} supprimé avec toutes ses données`
                      );
                      setShowDeleteDialog(false);
                      onDelete?.();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression");
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 cursor-pointer"
                >
                  {deleting ? "Suppression..." : "Supprimer définitivement"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </form>
  );
}
