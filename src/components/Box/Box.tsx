'use client';

import { useState, useEffect, useRef } from 'react';
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

            const apiUrl = `/api/boxes/${boxNumber}/files`;
            console.log(`Making request to: ${apiUrl}`);

            // check
            const res = await fetch(apiUrl, { redirect: 'manual' });
            console.log('status fetch', {
                redirected: res.redirected,
                type: res.type, // 'opaqueredirect' == blocked
                url: res.url,
                status: res.status
            });

            const response = await fetch(apiUrl);


            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error response body:`, errorText);
                throw new Error(`API returned ${response.status}: ${response.statusText}. Body: ${errorText}`);
            }

            const data = await response.json();
            console.log(`Box ${boxNumber} status:`, data);
            setBoxStatus(data);
        } catch (error) {
            console.error(`Error fetching box ${boxNumber} status:`, error);
            console.error(`Error details:`, {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        } finally {
            setLoading(false);
        }
    };

    const registeredRef = useRef(false);

    useEffect(() => {
        fetchBoxStatus();
        if (!registeredRef.current) {
            onRegisterCallback(boxNumber, fetchBoxStatus);
            registeredRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boxNumber]);

    const handleReceive = async () => {
        if (boxStatus.empty || !boxStatus.name) return;

        console.log(`Starting download for box ${boxNumber}, file: ${boxStatus.name}`);

        try {
            console.log(`Creating download link for box ${boxNumber}`);

            // Use direct link approach - more mobile-friendly and memory efficient
            const url = `/api/boxes/${boxNumber}/files/${encodeURIComponent(boxStatus.name)}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = boxStatus.name; // hint; server's Content-Disposition is authoritative
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log(`Download link clicked for box ${boxNumber}, waiting for status update...`);

            // File will be deleted by API after stream completes, Pusher event will be sent
            // Add fallback refresh for mobile devices where Pusher events might not work properly
            // TODO fix this later so it's not needed
            // setTimeout(() => {
            //     console.log(`Fallback refresh triggered for box ${boxNumber}`);
            //     fetchBoxStatus();
            // }, 2000); // Wait 2 seconds to allow for download and cleanup to complete

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