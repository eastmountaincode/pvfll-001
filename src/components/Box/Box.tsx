'use client';

import { useState, useEffect } from 'react';
import BoxHeader from './BoxHeader';
import BoxStatus from './BoxStatus';
import ReceiveButton from './ReceiveButton';
import UploadForm from './UploadForm';

interface BoxProps {
    boxNumber: number;
}

const backgroundColor = 'bg-green-400';

export default function Box({ boxNumber }: BoxProps) {
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

    useEffect(() => {
        fetchBoxStatus();
    }, []);

    const handleReceive = async () => {
        if (boxStatus.empty || !boxStatus.name) return;

        try {
            // Get download URL
            const response = await fetch(`/api/boxes/${boxNumber}/files/${encodeURIComponent(boxStatus.name)}`);
            if (!response.ok) throw new Error('Failed to get download URL');
            
            const { url } = await response.json();
            
            // Trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = boxStatus.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Delete the file from S3
            const deleteResponse = await fetch(`/api/boxes/${boxNumber}/files/${encodeURIComponent(boxStatus.name)}`, {
                method: 'DELETE'
            });
            if (!deleteResponse.ok) throw new Error('Failed to delete file');

            // Refresh box status to show it's now empty
            await fetchBoxStatus();
        } catch (error) {
            console.error('Error receiving file:', error);
        }
    };

    return (
        <div className="mx-[20px]">
            <div className={`border border-black max-w-sm mx-auto shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] ${backgroundColor}`}>
                <BoxHeader 
                    boxNumber={boxNumber} 
                    hasFile={!boxStatus.empty} 
                    loading={loading} 
                />
                <BoxStatus 
                    boxNumber={boxNumber}
                    loading={loading}
                    empty={boxStatus.empty}
                    fileName={boxStatus.name}
                    fileSize={boxStatus.size}
                />
                <ReceiveButton 
                    disabled={boxStatus.empty} 
                    onClick={handleReceive} 
                />
                <UploadForm 
                    boxNumber={boxNumber}
                    disabled={loading || !boxStatus.empty}
                    onUploadComplete={fetchBoxStatus}
                />
            </div>
        </div>
    );
}