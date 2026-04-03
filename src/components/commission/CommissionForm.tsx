"use client";
import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { commissionSchema, CommissionFormData } from "@/lib/validations";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

interface CommissionFormProps {
  initialReference?: string;
}

export function CommissionForm({ initialReference = "" }: CommissionFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<CommissionFormData>({
    resolver: zodResolver(commissionSchema),
    defaultValues: {
      idempotencyKey: "",
      name: "",
      email: "",
      imageUrl: "",
      publicId: "",
      size: "",
      budget: "",
      deadline: "",
      message: initialReference ? `Inquiry regarding artwork: ${initialReference}\n\n` : ""
    }
  });

  // Idempotency: Prevent duplicate requests by binding a UUID to this specific form session
  useEffect(() => {
    const currentIdem = getValues("idempotencyKey");
    if (!currentIdem) {
      setValue("idempotencyKey", crypto.randomUUID());
    }
  }, [setValue, getValues]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setServerError("Please upload a valid image (JPG, PNG).");
      setUploadState("error");
      return;
    }

    // Strict 5MB Client-Side Boundary
    if (file.size > 5 * 1024 * 1024) {
      setServerError("File exceeds the 5MB luxury limit. Please compress and try again.");
      setUploadState("error");
      return;
    }

    setUploadState("uploading");
    setServerError("");
    const result = await uploadImageToCloudinary(file);
    
    if (result && result.url) {
      setValue("imageUrl", result.url);
      setValue("publicId", result.publicId);
      setUploadState("done");
    } else {
      setUploadState("error");
      setServerError("The CDN failed to securely attach your reference.");
    }
  }, [setValue]);

  const onSubmit = async (data: CommissionFormData) => {
    setServerError("");
    
    // Front-end AbortController Timeout (8000ms max ceiling limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch("/api/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      const resData = await res.json();
      if (!res.ok || !resData.success) throw new Error(resData.message || "Failed to submit.");
      
      setIsSubmitted(true);
    } catch (err: any) {
      if (err.name === 'AbortError') {
         setServerError("The network took too long. Please ensure your connection is stable and try again.");
      } else {
         setServerError(err.message);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };

  if (isSubmitted) {
    return (
      <div className="py-24 text-center transition-opacity duration-1000 opacity-100">
        <h3 className="font-serif text-[32px] text-accent mb-4">Inquiry Received</h3>
        <p className="text-muted font-sans text-[15px]">The curator will review your request and respond shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={`flex flex-col gap-10 w-full animate-in fade-in duration-500 transition-opacity ${isSubmitting ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      
      {/* 1. Base Info */}
      <div className="flex flex-col md:flex-row gap-10">
        <div className="w-full flex flex-col">
          <Input type="text" placeholder="Your Name" {...register("name")} />
          {errors.name && <span className="text-red-500/80 text-[12px] mt-2 tracking-wide font-sans">{errors.name.message}</span>}
        </div>
        <div className="w-full flex flex-col">
          <Input type="email" placeholder="Email Address" {...register("email")} />
          {errors.email && <span className="text-red-500/80 text-[12px] mt-2 tracking-wide font-sans">{errors.email.message}</span>}
        </div>
      </div>

      {/* 2. File Upload Dropzone */}
      <div className="flex flex-col gap-2 relative">
        <label className="text-[11px] uppercase tracking-[0.15em] text-muted/60 mb-1 font-sans">Reference Material (Optional)</label>
        <div className={`relative border border-dashed p-8 text-center transition-colors duration-[600ms] 
          ${uploadState === "done" ? 'border-accent/40 bg-accent/5' : 'border-white/10 hover:bg-white/5'}`}>
          
          <input 
            type="file" 
            accept="image/jpeg, image/png, image/webp"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
          />
          
          <span className="text-[13px] text-muted/80 tracking-wide font-sans">
            {uploadState === "idle" && "Drag & drop or browse to upload"}
            {uploadState === "uploading" && "Uploading reference securely..."}
            {uploadState === "done" && "Image attached safely."}
            {uploadState === "error" && "Upload failed. Try again."}
          </span>
        </div>
      </div>

      {/* 3. Specs */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] uppercase tracking-[0.15em] text-muted/60 mb-2 font-sans">Desired Scale</label>
        <div className="flex flex-wrap gap-4">
          {["Small (< 24\")", "Medium (24\" - 48\")", "Vast (> 48\")", "Undecided"].map((opt) => (
            <label key={opt} className="relative cursor-pointer">
              <input type="radio" value={opt} {...register("size")} className="peer absolute opacity-0 w-full h-full cursor-pointer z-10" />
              <div className="px-6 py-3 border border-white/10 text-[12px] text-muted transition-colors duration-500 peer-checked:border-accent peer-checked:text-accent hover:border-white/30 font-sans">
                {opt}
              </div>
            </label>
          ))}
        </div>
        {errors.size && <span className="text-red-500/80 text-[12px] mt-2 tracking-wide font-sans">{errors.size.message}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] uppercase tracking-[0.15em] text-muted/60 mb-2 font-sans">Budget Range</label>
        <div className="flex flex-wrap gap-4">
          {["$2k - $5k", "$5k - $10k", "$10k+", "Undisclosed"].map((opt) => (
            <label key={opt} className="relative cursor-pointer">
              <input type="radio" value={opt} {...register("budget")} className="peer absolute opacity-0 w-full h-full cursor-pointer z-10" />
              <div className="px-6 py-3 border border-white/10 text-[12px] text-muted transition-colors duration-500 peer-checked:border-accent peer-checked:text-accent hover:border-white/30 font-sans">
                {opt}
              </div>
            </label>
          ))}
        </div>
        {errors.budget && <span className="text-red-500/80 text-[12px] mt-2 tracking-wide font-sans">{errors.budget.message}</span>}
      </div>

      <div className="flex flex-col">
        <Input type="text" placeholder="Target Deadline (Optional)" {...register("deadline")} />
      </div>

      {/* 4. Intent */}
      <div className="flex flex-col">
        <Textarea placeholder="Detail your vision and intent..." rows={4} {...register("message")} />
        {errors.message && <span className="text-red-500/80 text-[12px] mt-2 tracking-wide font-sans">{errors.message.message}</span>}
      </div>

      {serverError && <p className="text-red-500/80 text-[13px] tracking-wide font-sans">{serverError}</p>}

      {/* 5. CTA */}
      <div className="pt-6">
        <Button disabled={isSubmitting || uploadState === "uploading"} type="submit" className="w-full">
          {isSubmitting ? "Transmitting Requirements..." : "Submit Request"}
        </Button>
      </div>
      
    </form>
  );
}
