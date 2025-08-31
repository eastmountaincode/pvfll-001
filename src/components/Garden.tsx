import Box from './Box';

export default function Garden() {
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
            <Box boxNumber={1} isFirst />
            <Box boxNumber={2} />
            <Box boxNumber={3} />
            <Box boxNumber={4} />
        </div>
    );
}
