'use client';

import React, { useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, TagIcon } from '@heroicons/react/24/outline';
import { Emotion } from '@/types/chat';

interface SearchBoxProps {
  onSearch: (params: {
    keyword: string;
    startDate: string;
    endDate: string;
    selectedEmotions: string[];
  }) => void;
  availableEmotions?: Emotion[];
}

export const SearchBox: React.FC<SearchBoxProps> = ({ onSearch, availableEmotions = [] }) => {
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [showEmotionDropdown, setShowEmotionDropdown] = useState(false);

  const handleSearch = () => {
    onSearch({
      keyword,
      startDate,
      endDate,
      selectedEmotions,
    });
  };

  const handleClear = () => {
    setKeyword('');
    setStartDate('');
    setEndDate('');
    setSelectedEmotions([]);
    onSearch({
      keyword: '',
      startDate: '',
      endDate: '',
      selectedEmotions: [],
    });
  };

  const toggleEmotion = (emotionName: string) => {
    setSelectedEmotions(prev =>
      prev.includes(emotionName)
        ? prev.filter(e => e !== emotionName)
        : [...prev, emotionName]
    );
  };

  const getEmotionColor = (emotionName: string): string => {
    const colorMap: Record<string, string> = {
      joy: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      love: 'bg-pink-100 text-pink-800 border-pink-300',
      trust: 'bg-green-100 text-green-800 border-green-300',
      gratitude: 'bg-purple-100 text-purple-800 border-purple-300',
      hope: 'bg-blue-100 text-blue-800 border-blue-300',
      relief: 'bg-teal-100 text-teal-800 border-teal-300',
      pride: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      contentment: 'bg-lime-100 text-lime-800 border-lime-300',
      anticipation: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      sadness: 'bg-gray-100 text-gray-800 border-gray-300',
      anger: 'bg-red-100 text-red-800 border-red-300',
      fear: 'bg-orange-100 text-orange-800 border-orange-300',
      anxiety: 'bg-amber-100 text-amber-800 border-amber-300',
      frustration: 'bg-rose-100 text-rose-800 border-rose-300',
      guilt: 'bg-stone-100 text-stone-800 border-stone-300',
      shame: 'bg-zinc-100 text-zinc-800 border-zinc-300',
      disappointment: 'bg-slate-100 text-slate-800 border-slate-300',
      loneliness: 'bg-gray-200 text-gray-700 border-gray-400',
      disgust: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      surprise: 'bg-violet-100 text-violet-800 border-violet-300',
    };
    return colorMap[emotionName] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const hasFilters = keyword || startDate || endDate || selectedEmotions.length > 0;

  return (
    <div className="bg-white/75 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      {/* 期間検索 - 常に表示 */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3 py-2 text-black border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="block w-full px-3 py-2 text-black border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 感情タグ検索 */}
      {availableEmotions.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmotionDropdown(!showEmotionDropdown)}
              className="w-full px-3 py-2 text-left bg-white/80 backdrop-blur-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-gray-400" />
                {selectedEmotions.length > 0 ? (
                  <span className="text-black">
                    {selectedEmotions.length}個の感情を選択中
                  </span>
                ) : (
                  <span className="text-gray-500">感情タグで絞り込み...</span>
                )}
              </span>
              <svg
                className={`h-5 w-5 text-gray-400 transform transition-transform ${
                  showEmotionDropdown ? 'rotate-180' : ''
                }`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            {/* ドロップダウンメニュー */}
            {showEmotionDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                <div className="p-2">
                  {availableEmotions.map((emotion) => (
                    <label
                      key={emotion.name}
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmotions.includes(emotion.name)}
                        onChange={() => toggleEmotion(emotion.name)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          getEmotionColor(emotion.name)
                        }`}
                      >
                        {emotion.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 選択された感情タグの表示 */}
          {selectedEmotions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedEmotions.map((emotionName) => {
                const emotion = availableEmotions.find(e => e.name === emotionName);
                return emotion ? (
                  <span
                    key={emotionName}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      getEmotionColor(emotionName)
                    }`}
                  >
                    {emotion.label}
                    <button
                      type="button"
                      onClick={() => toggleEmotion(emotionName)}
                      className="ml-1 inline-flex items-center justify-center w-3 h-3 text-current"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}

      {/* キーワード検索 */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="キーワードで検索..."
          className="block w-full pl-10 pr-3 py-2 text-black border border-gray-300 rounded-md leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {/* 検索・クリアボタン */}
      <div className="flex gap-2">
        <button
          onClick={handleSearch}
          className="flex-1 px-4 py-2 bg-blue-600/90 backdrop-blur-sm text-white text-sm font-medium rounded-md hover:bg-blue-700/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          検索
        </button>
        {hasFilters && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-100/70 backdrop-blur-sm text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors flex items-center gap-1"
          >
            <XMarkIcon className="h-4 w-4" />
            クリア
          </button>
        )}
      </div>
    </div>
  );
};