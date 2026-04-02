"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export function CommissionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Fake backend delay representing API route fetch
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  // Submission feedback: Replaces form entirely with a calm confirmation
  if (isSubmitted) {
    return (
      <div className="py-24 text-center transition-opacity duration-1000 opacity-100">
        <h3 className="font-serif text-[32px] text-accent mb-4">Inquiry Received</h3>
        <p className="text-muted font-sans text-[15px]">The curator will review your request and respond shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10 w-full">
      <div className="flex flex-col md:flex-row gap-10">
        <Input required type="text" placeholder="Your Name" />
        <Input required type="email" placeholder="Email Address" />
      </div>
      
      {/* Subtle Drag and Drop Interface */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] uppercase tracking-[0.15em] text-muted/60 mb-1">Reference Material (Optional)</label>
        <div className="border border-white/10 border-dashed p-8 text-center cursor-pointer hover:bg-white/5 transition-colors duration-[600ms]">
          <span className="text-[13px] text-muted/80 tracking-wide">Drag & drop or browse to upload</span>
        </div>
      </div>

      <Input required type="text" placeholder="Desired Dimensions (e.g. 40x80 inches)" />
      
      <Textarea required placeholder="Detail your vision..." rows={3} />

      <div className="pt-6">
        <Button disabled={isSubmitting} type="submit" className="w-full">
          {isSubmitting ? "Transmitting..." : "Submit Inquiry"}
        </Button>
      </div>
    </form>
  );
}
