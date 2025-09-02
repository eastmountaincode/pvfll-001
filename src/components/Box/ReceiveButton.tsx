interface ReceiveButtonProps {
    disabled: boolean;
    onClick: () => void;
}

const downloadColor = 'bg-red-400';
const disabledOpacity = 'opacity-20';

export default function ReceiveButton({ disabled, onClick }: ReceiveButtonProps) {
    return (
        <button 
            className={`mx-2.5 px-2 py-1 border ${disabled ? disabledOpacity + ' cursor-not-allowed' : 'cursor-pointer'} ${downloadColor}`} 
            type="button" 
            disabled={disabled}
            onClick={onClick}
        >
            Receive
        </button>
    );
}
