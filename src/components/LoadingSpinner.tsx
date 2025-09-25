export default function LoadingSpinner({
  message = 'AI分析中です',
  size = 'normal'
}: {
  message?: string;
  size?: 'small' | 'normal';
}) {
  const isSmall = size === 'small';

  return (
    <div className={`flex flex-col items-center justify-center ${isSmall ? 'py-4' : 'py-8'}`}>
      {/* スピナー */}
      <div className="relative">
        <div className={`${isSmall ? 'w-8 h-8' : 'w-12 h-12'} rounded-full animate-spin border-3 border-solid border-indigo-200 border-t-indigo-600`}></div>
        <div className={`absolute top-0 left-0 ${isSmall ? 'w-8 h-8' : 'w-12 h-12'} rounded-full animate-pulse bg-indigo-100 opacity-20`}></div>
      </div>

      {/* メッセージ */}
      <p className={`${isSmall ? 'mt-2 text-xs' : 'mt-4 text-sm'} text-gray-600 font-medium`}>
        {message}
      </p>

      {/* ドット表示 */}
      <div className="flex space-x-1 mt-2">
        <div className={`${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-indigo-600 rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
        <div className={`${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-indigo-600 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
        <div className={`${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-indigo-600 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
}