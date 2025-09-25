export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="relative inline-flex">
          <div className="w-16 h-16 bg-blue-500 rounded-full animate-ping"></div>
          <div className="w-16 h-16 bg-blue-500 rounded-full animate-ping absolute top-0 left-0 animation-delay-200"></div>
          <div className="w-16 h-16 bg-blue-500 rounded-full absolute top-0 left-0"></div>
        </div>
        <p className="mt-4 text-lg text-gray-600">心のログを起動中...</p>
      </div>
    </div>
  );
}