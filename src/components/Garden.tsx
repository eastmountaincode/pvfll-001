'use client';

import { useEffect, useRef } from 'react';
import Box from './Box/Box';
import { pusherClient } from '@/lib/pusher';

export default function Garden() {
    const boxUpdateCallbacks = useRef<{ [boxNumber: number]: () => void }>({});

    useEffect(() => {
        // Subscribe to the garden channel
        const channel = pusherClient.subscribe('garden');
        
        // Listen for file upload events
        channel.bind('file-uploaded', (data: { boxNumber: string }) => {
            const boxNumber = parseInt(data.boxNumber);
            if (boxUpdateCallbacks.current[boxNumber]) {
                boxUpdateCallbacks.current[boxNumber]();
            }
        });
        
        // Listen for file deletion events
        channel.bind('file-deleted', (data: { boxNumber: string }) => {
            const boxNumber = parseInt(data.boxNumber);
            if (boxUpdateCallbacks.current[boxNumber]) {
                boxUpdateCallbacks.current[boxNumber]();
            }
        });

        // Cleanup on unmount
        return () => {
            pusherClient.unsubscribe('garden');
        };
    }, []);

    const registerBoxCallback = (boxNumber: number, callback: () => void) => {
        boxUpdateCallbacks.current[boxNumber] = callback;
    };

    return (
        <div className="min-h-screen font-serif font-normal">
            {/* Main Header */}
            <div className="text-center mx-5 my-5">
                <h2 className="text-xl">
                    ✿ ❀ ❁ ❃ ❋ <br />
                    pvfll_001 <br />
                    ❋ ❃ ❁ ❀ ✿
                </h2>
            </div>
            <div className="pt-[10px] pb-[40px] space-y-[30px]">
                <Box boxNumber={1} onRegisterCallback={registerBoxCallback} />
                <Box boxNumber={2} onRegisterCallback={registerBoxCallback} />
                <Box boxNumber={3} onRegisterCallback={registerBoxCallback} />
                <Box boxNumber={4} onRegisterCallback={registerBoxCallback} />
            </div>
        </div>
    );
}
