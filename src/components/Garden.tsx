'use client';

import { useEffect, useRef, useCallback } from 'react';
import Box from './Box/Box';
import { pusherClient } from '@/lib/pusher';

export default function Garden() {
    const boxUpdateCallbacks = useRef<{ [boxNumber: number]: () => void }>({});

    useEffect(() => {
        // Log Pusher connection state for debugging
        console.log('Pusher connection state:', pusherClient.connection.state);
        
        // Subscribe to the garden channel
        const channel = pusherClient.subscribe('garden');
        
        // Log connection events for debugging mobile issues
        pusherClient.connection.bind('connected', () => {
            console.log('Pusher: Connected');
        });
        
        pusherClient.connection.bind('disconnected', () => {
            console.log('Pusher: Disconnected');
        });
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pusherClient.connection.bind('error', (error: any) => {
            console.log('Pusher: Connection error', error);
        });
        
        // Listen for file upload events
        channel.bind('file-uploaded', (data: { boxNumber: string }) => {
            console.log('Pusher: file-uploaded event received', data);
            const boxNumber = parseInt(data.boxNumber);
            if (boxUpdateCallbacks.current[boxNumber]) {
                boxUpdateCallbacks.current[boxNumber]();
            }
        });
        
        // Listen for file deletion events
        channel.bind('file-deleted', (data: { boxNumber: string }) => {
            console.log('Pusher: file-deleted event received', data);
            const boxNumber = parseInt(data.boxNumber);
            if (boxUpdateCallbacks.current[boxNumber]) {
                boxUpdateCallbacks.current[boxNumber]();
            }
        });

        // Cleanup on unmount
        return () => {
            pusherClient.connection.unbind('connected');
            pusherClient.connection.unbind('disconnected');
            pusherClient.connection.unbind('error');
            pusherClient.unsubscribe('garden');
        };
    }, []);

    const registerBoxCallback = useCallback((boxNumber: number, callback: () => void) => {
        boxUpdateCallbacks.current[boxNumber] = callback;
    }, []);

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
