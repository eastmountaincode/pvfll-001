'use client';

import { useState } from 'react';

interface BoxProps {
    boxNumber: number;
    isFirst?: boolean;
}

export default function Box({ boxNumber, isFirst = false }: BoxProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setSelectedFile(file);
        setUploadProgress(0);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // prevent the browser's default form submission, which would reload the page
        if (!selectedFile) return;

        // 1) ask api for a presigned POST url
        const presignResponse = await fetch('/api/files', {
            method: 'POST',
            body: JSON.stringify({
                boxNumber,
                fileName: selectedFile.name,
                fileType: selectedFile.type || "application/octet-stream",
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!presignResponse.ok) throw new Error('Failed to get presigned POST URL');
        const { url, fields, key} = await presignResponse.json();

        // 2) upload straight to s3
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
                // S3 returns 204 by default, or 201 if you set success_action_status
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
    };

    return (
        <div className={`mx-[20px] ${!isFirst ? 'mt-[30px]' : ''}`}>
            <div className="border border-black max-w-sm mx-auto shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center">
                    <p className="font-black mx-2.5 mb-2 text-4xl">{boxNumber}</p>
                </div>
                <form className="mx-2.5" onSubmit={handleSubmit}>
                    <label className="inline-block px-2 py-1 border cursor-pointer">
                        Choose File
                        <input
                            type="file"
                            name="fileToUpload"
                            required
                            className="hidden"
                            onChange={handleFileChange}
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
                        className={`mt-1 px-2 py-1 border ${selectedFile ? 'cursor-pointer' : ''} ${!selectedFile ? 'opacity-50' : ''}`}
                    />
                </form>
                <button className="mx-2.5 mt-1 px-2 py-1 border cursor-pointer" type="button" disabled>
                    Receive
                </button>
                <p className="m-2.5 mt-3">box{boxNumber}: empty</p>
            </div>
        </div>
    );
}
