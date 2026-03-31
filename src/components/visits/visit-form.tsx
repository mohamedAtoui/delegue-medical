"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DoctorSearch } from "@/components/doctors/doctor-search";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { ProductSelect } from "@/components/shared/product-select";
import { DoctorVisitTimeline } from "@/components/visits/doctor-visit-timeline";
import { toast } from "sonner";
import { Send } from "lucide-react";
import type { Doctor } from "@/types";

interface VisitFormProps {
  onSuccess: () => void;
}

export function VisitForm({ onSuccess }: VisitFormProps) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [productId, setProductId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!doctor || !productId) {
      toast.error("Veuillez sélectionner un médecin et un produit");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: doctor.id,
          product_id: productId,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast.success("Visite enregistrée avec succès");
      setDoctor(null);
      setNotes("");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>Médecin *</Label>
          <DoctorSearch
            selectedDoctor={doctor}
            onSelect={setDoctor}
            onCreateNew={() => setShowDoctorForm(true)}
          />
        </div>

        {/* Show doctor's visit history when a doctor is selected */}
        {doctor && (
          <>
            <Separator />
            <DoctorVisitTimeline doctorId={doctor.id} />
            <Separator />
          </>
        )}

        <div className="space-y-2">
          <Label>Produit *</Label>
          <ProductSelect value={productId} onValueChange={setProductId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Nouveau commentaire</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Écrivez vos observations, remarques du médecin, retours sur le produit..."
            className="min-h-[150px] resize-none"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !doctor || !productId}
          className="w-full"
          size="lg"
        >
          {loading ? (
            "Enregistrement..."
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enregistrer la visite
            </>
          )}
        </Button>
      </form>

      <Dialog open={showDoctorForm} onOpenChange={setShowDoctorForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un nouveau médecin</DialogTitle>
          </DialogHeader>
          <DoctorForm
            onSuccess={(newDoctor) => {
              setDoctor(newDoctor);
              setShowDoctorForm(false);
            }}
            onCancel={() => setShowDoctorForm(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
