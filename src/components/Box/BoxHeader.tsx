import { FaFile } from 'react-icons/fa';

interface BoxHeaderProps {
    boxNumber: number;
    hasFile: boolean;
    loading: boolean;
}

export default function BoxHeader({ boxNumber, hasFile, loading }: BoxHeaderProps) {
    return (
        <div className="mt-1 flex items-center justify-between">
            <p className="font-black mx-2.5 mb-2 text-4xl">{boxNumber}</p>
            {!loading && hasFile && (
                <FaFile className="mx-2.5 mb-2 text-2xl text-red-400" />
            )}
        </div>
    );
}
