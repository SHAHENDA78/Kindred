"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { X, Check } from "lucide-react";

interface ImageCropperModalProps {
  imageSrc: string;
  onCancel: () => void;
  onCropDone: (croppedFile: File) => void;
  aspect?: number;
  cropShape?: "rect" | "round";
  outputFileName?: string;
}

async function getCroppedImg(
  imageSrc: string,
  cropArea: Area,
  fileName: string = "avatar.jpg"
): Promise<File> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement("canvas");
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(new File([blob], fileName, { type: "image/jpeg" }));
        }
      },
      "image/jpeg",
      0.9
    );
  });
}

export function ImageCropperModal({
  imageSrc,
  onCancel,
  onCropDone,
  aspect = 1,
  cropShape = "round",
  outputFileName = "avatar.jpg",
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    const file = await getCroppedImg(imageSrc, croppedAreaPixels, outputFileName);
    setProcessing(false);
    onCropDone(file);
  }

  return (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full">
        <div className="relative w-full h-80 bg-ink">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === "rect"}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-bold text-stone uppercase tracking-widest mb-2 block">
              Zoom
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-line rounded-2xl text-xs font-bold uppercase tracking-widest text-stone hover:bg-paper transition-all"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              <Check size={14} /> {processing ? "..." : "Use Photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
