interface BoxStatusProps {
    boxNumber: number;
    loading: boolean;
    empty: boolean;
    fileName?: string;
    fileSize?: number;
}

export default function BoxStatus({ boxNumber, loading, empty, fileName, fileSize }: BoxStatusProps) {
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <p className="m-2.5 mt-0.5 border px-2 py-1">
            {loading 
                ? `box${boxNumber}: loading...`
                : empty 
                    ? `box${boxNumber}: empty`
                    : `file in box${boxNumber}: ${fileName} (${formatSize(fileSize!)})`
            }
        </p>
    );
}
