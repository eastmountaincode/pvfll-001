'use client';

import { useState } from 'react';

interface UploadFormProps {
    boxNumber: number;
    disabled: boolean;
    onUploadComplete: () => void;
}

const uploadColor = 'bg-yellow-400';
const disabledOpacity = 'opacity-20';

export default function UploadForm({ boxNumber, disabled, onUploadComplete }: UploadFormProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setSelectedFile(file);
        setUploadProgress(0);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedFile) return;

        try {
            // Get presigned POST URL
            const presignResponse = await fetch(`/api/boxes/${boxNumber}/files`, {
                method: 'POST',
                body: JSON.stringify({
                    fileName: selectedFile.name,
                    fileType: selectedFile.type || "application/octet-stream",
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!presignResponse.ok) throw new Error('Failed to get presigned POST URL');
            const { url, fields, key } = await presignResponse.json();

            // Upload to S3
            const formData = new FormData();
            Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
            formData.append('file', selectedFile);

            setUploading(true);
            setUploadProgress(0);

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (ev) => {
                    if (ev.lengthComputable) {
                        const pct = Math.round((ev.loaded / ev.total) * 100);
                        setUploadProgress(pct);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 204 || xhr.status === 201) {
                        setUploadProgress(100);
                        resolve();
                    } else {
                        reject(new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.open('POST', url);
                xhr.send(formData);
            }).finally(() => setUploading(false));

            console.log('File uploaded to S3 successfully', key);
            
            // Clear selected file and notify parent
            setSelectedFile(null);
            onUploadComplete();
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };

    return (
        <form className="mt-2.5 mx-2.5" onSubmit={handleSubmit}>
            <label className={`inline-block px-2 py-1 border ${disabled ? disabledOpacity + ' cursor-not-allowed' : 'cursor-pointer'} ${uploadColor}`}>
                Choose File
                <input
                    type="file"
                    name="fileToUpload"
                    required
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={disabled}
                />
            </label>
            {selectedFile && (
                <p className="mt-2">Selected: {selectedFile.name}</p>
            )}

            {uploading && (
                <progress
                    value={uploadProgress}
                    max={100}
                    className="mt-2 w-full"
                />
            )}

            <br />
            <input
                type="submit"
                value="Offer"
                disabled={!selectedFile}
                className={`my-2.5 px-2 py-1 border ${selectedFile ? 'cursor-pointer' : ''} ${!selectedFile ? disabledOpacity : ''} ${uploadColor}`}
            />
        </form>
    );
}
