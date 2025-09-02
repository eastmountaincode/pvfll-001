'use client';

import { useState, useEffect } from 'react';
import { FaFile } from 'react-icons/fa';

interface BoxProps {
    boxNumber: number;
}

const downloadColor = 'bg-red-400';
const uploadColor = 'bg-yellow-400';
const backgroundColor = 'bg-green-400';
const disabledOpacity = 'opacity-20';

export default function Box({ boxNumber }: BoxProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [boxStatus, setBoxStatus] = useState<{ empty: boolean; name?: string; size?: number }>({ empty: true });
    const [loading, setLoading] = useState(true);

    const fetchBoxStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/boxes/${boxNumber}/files`);
            const data = await response.json();
            setBoxStatus(data);
        } catch (error) {
            console.error('Error fetching box status:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    useEffect(() => {
        fetchBoxStatus();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setSelectedFile(file);
        setUploadProgress(0);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // prevent the browser's default form submission, which would reload the page
        if (!selectedFile) return;

        // 1) ask api for a presigned POST url
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
        
        // Refresh box status after successful upload
        await fetchBoxStatus();
    };

    return (
        <div className="mx-[20px]">
            <div className={`border border-black max-w-sm mx-auto shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] ${backgroundColor}`}>
                
                {/* BOX NUMBER */}
                <div className="mt-1 flex items-center justify-between">
                    <p className="font-black mx-2.5 mb-2 text-4xl">{boxNumber}</p>
                    {!loading && !boxStatus.empty && (
                        <FaFile className="mx-2.5 mb-2 text-2xl text-red-400" />
                    )}
                </div>
                {/* BOX STATUS */}
                <p className={`m-2.5 mt-0.5 border px-2 py-1`}>
                    {loading 
                        ? `box${boxNumber}: loading...`
                        : boxStatus.empty 
                            ? `box${boxNumber}: empty`
                            : `file in box${boxNumber}: ${boxStatus.name} (${formatSize(boxStatus.size!)})`
                    }
                </p>
                {/* RECEIVE */}
                <button 
                    className={`mx-2.5 px-2 py-1 border ${boxStatus.empty ? disabledOpacity + ' cursor-not-allowed' : 'cursor-pointer'} ${downloadColor}`} 
                    type="button" 
                    disabled={boxStatus.empty}
                >
                    Receive
                </button>
                {/* UPLOAD */}
                <form className="mt-2.5 mx-2.5" onSubmit={handleSubmit}>
                                         <label className={`inline-block px-2 py-1 border ${loading || !boxStatus.empty ? disabledOpacity + ' cursor-not-allowed' : 'cursor-pointer'} ${uploadColor}`}>
                         Choose File
                         <input
                             type="file"
                             name="fileToUpload"
                             required
                             className="hidden"
                             onChange={handleFileChange}
                             disabled={loading || !boxStatus.empty}
                         />
                     </label>
                    {selectedFile && (
                        <p className="mt-2 ${uploadColor}">Selected: {selectedFile.name}</p>
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
                
            </div>
        </div>
    );
}
