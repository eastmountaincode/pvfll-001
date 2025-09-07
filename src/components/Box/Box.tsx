'use client';

import { useState, useEffect } from 'react';
import BoxHeader from './BoxHeader';
import BoxStatus from './BoxStatus';
import ReceiveButton from './ReceiveButton';
import UploadForm from './UploadForm';

interface BoxProps {
    boxNumber: number;
    onRegisterCallback: (boxNumber: number, callback: () => void) => void;
}

const backgroundColor = 'bg-green-400';

export default function Box({ boxNumber, onRegisterCallback }: BoxProps) {
    const [boxStatus, setBoxStatus] = useState<{ empty: boolean; name?: string; size?: number }>({ empty: true });
    const [loading, setLoading] = useState(true);

    const fetchBoxStatus = async () => {
        try {
            setLoading(true);
            console.log(`Fetching status for box ${boxNumber}`);
            const response = await fetch(`/api/boxes/${boxNumber}/files`);
            const data = await response.json();
            console.log(`Box ${boxNumber} status:`, data);
            setBoxStatus(data);
        } catch (error) {
            console.error('Error fetching box status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoxStatus();
        // Register this box's update callback with the Garden component
        onRegisterCallback(boxNumber, fetchBoxStatus);
    }, [boxNumber, onRegisterCallback]);

    const handleReceive = async () => {
        if (boxStatus.empty || !boxStatus.name) return;

        console.log(`Starting download for box ${boxNumber}, file: ${boxStatus.name}`);

        try {
            // Fetch the file (this triggers API call immediately - deletes file and sends Pusher event)
            const response = await fetch(`/api/boxes/${boxNumber}/files/${encodeURIComponent(boxStatus.name)}`);
            if (!response.ok) throw new Error('Download failed');
            
            console.log(`Download API call successful for box ${boxNumber}`);
            
            // Create blob and trigger download
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = boxStatus.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log(`Download triggered for box ${boxNumber}, waiting for status update...`);
            
            // File is already deleted by API, Pusher event already sent
            // Add fallback refresh for mobile devices where Pusher events might not work properly
            setTimeout(() => {
                console.log(`Fallback refresh triggered for box ${boxNumber}`);
                fetchBoxStatus();
            }, 1000); // Wait 1 second to allow for any pending Pusher events
            
        } catch (error) {
            console.error('Error receiving file:', error);
            // Refresh status in case file was deleted by someone else
            await fetchBoxStatus();
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