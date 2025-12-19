"use client";

import { useRouter } from "next/navigation";
import { GalleryView } from "@/components/galleries";
import { useGalleries } from "@/hooks";

interface GalleryPageProps {
  params: {
    id: string;
  };
}

export default function GalleryPage({ params }: GalleryPageProps) {
  const router = useRouter();
  const { deleteGallery } = useGalleries();

  const handleDelete = () => {
    deleteGallery(params.id);
    router.push("/galleries");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <GalleryView galleryId={params.id} onDelete={handleDelete} />
      </div>
    </div>
  );
}
