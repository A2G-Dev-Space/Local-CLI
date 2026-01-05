import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Bug, Lightbulb, HelpCircle, Send, Trash2, MessageSquare,
  CheckCircle, Clock, AlertCircle, X, ChevronDown, BookOpen, Zap, Image as ImageIcon
} from 'lucide-react';
import { feedbackApi } from '../services/api';

interface FeedbackItem {
  id: string;
  category: 'ISSUE' | 'FEATURE' | 'QUESTION' | 'DOCS' | 'PERFORMANCE' | 'OTHER';
  title: string;
  content: string;
  images?: string[];
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  response: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    loginid: string;
    username: string;
    deptname: string;
  };
  responder: {
    loginid: string;
  } | null;
}

interface FeedbackProps {
  isAdmin: boolean;
}

const categoryConfig = {
  ISSUE: { icon: Bug, label: '버그/문제', color: 'text-red-500', bg: 'bg-red-50' },
  FEATURE: { icon: Lightbulb, label: '기능 제안', color: 'text-yellow-500', bg: 'bg-yellow-50' },
  QUESTION: { icon: HelpCircle, label: '질문/도움', color: 'text-blue-500', bg: 'bg-blue-50' },
  DOCS: { icon: BookOpen, label: '문서 개선', color: 'text-purple-500', bg: 'bg-purple-50' },
  PERFORMANCE: { icon: Zap, label: '성능 이슈', color: 'text-orange-500', bg: 'bg-orange-50' },
  OTHER: { icon: HelpCircle, label: '기타', color: 'text-gray-500', bg: 'bg-gray-50' },
};

const statusConfig = {
  OPEN: { icon: AlertCircle, label: '접수됨', color: 'text-blue-500', bg: 'bg-blue-50' },
  IN_PROGRESS: { icon: Clock, label: '검토 중', color: 'text-yellow-500', bg: 'bg-yellow-50' },
  RESOLVED: { icon: CheckCircle, label: '해결됨', color: 'text-green-500', bg: 'bg-green-50' },
  CLOSED: { icon: X, label: '종료', color: 'text-gray-500', bg: 'bg-gray-50' },
};

export default function Feedback({ isAdmin }: FeedbackProps) {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [filter, setFilter] = useState<{ status?: string; category?: string }>({});

  useEffect(() => {
    loadFeedbacks();
  }, [filter]);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      const response = await feedbackApi.list(filter);
      setFeedbacks(response.data.data);
    } catch (error) {
      console.error('Failed to load feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: { category: string; title: string; content: string; images: string[] }) => {
    try {
      await feedbackApi.create(data);
      setShowCreateModal(false);
      loadFeedbacks();
    } catch (error) {
      console.error('Failed to create feedback:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await feedbackApi.delete(id);
      loadFeedbacks();
    } catch (error) {
      console.error('Failed to delete feedback:', error);
    }
  };

  const handleRespond = async (id: string, response: string, status: string) => {
    try {
      await feedbackApi.respond(id, { response, status });
      loadFeedbacks();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Failed to respond:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">피드백</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? '사용자 피드백을 관리하세요' : '버그 신고, 기능 제안 등을 남겨주세요'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-samsung-blue text-white rounded-xl hover:bg-samsung-blue-dark transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 피드백
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filter.category || ''}
          onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
        >
          <option value="">모든 카테고리</option>
          <option value="ISSUE">버그/문제</option>
          <option value="FEATURE">기능 제안</option>
          <option value="QUESTION">질문/도움</option>
          <option value="DOCS">문서 개선</option>
          <option value="PERFORMANCE">성능 이슈</option>
          <option value="OTHER">기타</option>
        </select>
        <select
          value={filter.status || ''}
          onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
        >
          <option value="">모든 상태</option>
          <option value="OPEN">접수됨</option>
          <option value="IN_PROGRESS">검토 중</option>
          <option value="RESOLVED">해결됨</option>
          <option value="CLOSED">종료</option>
        </select>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">피드백이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => {
            const category = categoryConfig[feedback.category];
            const status = statusConfig[feedback.status];
            const CategoryIcon = category.icon;
            const StatusIcon = status.icon;

            return (
              <div
                key={feedback.id}
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedFeedback(feedback);
                  setShowDetailModal(true);
                }}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${category.bg}`}>
                    <CategoryIcon className={`w-5 h-5 ${category.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{feedback.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {feedback.images && feedback.images.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          <ImageIcon className="w-3 h-3" />
                          {feedback.images.length}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{feedback.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>{feedback.user.username}</span>
                      <span>{new Date(feedback.createdAt).toLocaleDateString('ko-KR')}</span>
                      {feedback.response && (
                        <span className="text-green-500">답변 완료</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateFeedbackModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          isAdmin={isAdmin}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedFeedback(null);
          }}
          onDelete={handleDelete}
          onRespond={handleRespond}
        />
      )}
    </div>
  );
}

// Create Feedback Modal
function CreateFeedbackModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { category: string; title: string; content: string; images: string[] }) => Promise<void>;
}) {
  const [category, setCategory] = useState('ISSUE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate({ category, title, content, images });
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setImages(prev => [...prev, base64]);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }, []);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">새 피드백</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.entries(categoryConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      category === key
                        ? 'border-samsung-blue bg-samsung-blue/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${category === key ? 'text-samsung-blue' : config.color}`} />
                    <span className="text-xs font-medium block truncate">{config.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Log files notice for bug/performance issues */}
            {(category === 'ISSUE' || category === 'PERFORMANCE') && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>💡 디버깅을 위해 로그 파일을 첨부해주세요!</strong>
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  CLI에서 <code className="bg-amber-100 px-1 py-0.5 rounded">Ctrl+O</code>를 누르면 로그 파일 경로를 확인할 수 있습니다:
                </p>
                <ul className="text-xs text-amber-700 mt-1 ml-4 list-disc">
                  <li>Session 로그 (session_log.jsonl)</li>
                  <li>Browser Server 로그 (browser-server_log.jsonl)</li>
                  <li>Office Server 로그 (office-server_log.jsonl)</li>
                </ul>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="피드백 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내용
              <span className="text-gray-400 font-normal ml-2">(이미지 붙여넣기 가능)</span>
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-samsung-blue focus:border-transparent h-64 resize-none"
              placeholder="상세한 내용을 작성해주세요. 이미지를 복사하여 붙여넣을 수 있습니다."
              required
            />
          </div>

          {/* Image Preview */}
          {images.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                첨부 이미지 ({images.length})
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`첨부 이미지 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim()}
              className="flex-1 px-4 py-3 bg-samsung-blue text-white rounded-xl hover:bg-samsung-blue-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  등록
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Feedback Detail Modal
function FeedbackDetailModal({
  feedback,
  isAdmin,
  onClose,
  onDelete,
  onRespond,
}: {
  feedback: FeedbackItem;
  isAdmin: boolean;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onRespond: (id: string, response: string, status: string) => Promise<void>;
}) {
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState('RESOLVED');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const category = categoryConfig[feedback.category];
  const statusInfo = statusConfig[feedback.status];
  const CategoryIcon = category.icon;

  const handleRespond = async () => {
    if (!response.trim()) return;
    setLoading(true);
    try {
      await onRespond(feedback.id, response, status);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(feedback.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // 삭제 가능 여부: Admin은 모두 삭제 가능, 일반 사용자는 답변 없는 본인 피드백만
  const canDelete = isAdmin || !feedback.response;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${category.bg}`}>
                  <CategoryIcon className={`w-5 h-5 ${category.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{feedback.title}</h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <span>{feedback.user.username}</span>
                    <span>·</span>
                    <span>{new Date(feedback.createdAt).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className="text-sm text-gray-400">{category.label}</span>
            </div>

            {/* Content */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{feedback.content}</p>
            </div>

            {/* Images */}
            {feedback.images && feedback.images.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">첨부 이미지</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {feedback.images.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`첨부 이미지 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedImage(img)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Response (if exists) */}
            {feedback.response && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700">관리자 답변</span>
                  {feedback.responder && (
                    <span className="text-xs text-green-600">by {feedback.responder.loginid}</span>
                  )}
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{feedback.response}</p>
              </div>
            )}

            {/* Admin Response Form */}
            {isAdmin && !feedback.response && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">답변 작성</h3>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-samsung-blue focus:border-transparent h-32 resize-none"
                  placeholder="답변을 작성하세요"
                />
                <div className="flex items-center gap-3 mt-3">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="RESOLVED">해결됨</option>
                    <option value="IN_PROGRESS">검토 중</option>
                    <option value="CLOSED">종료</option>
                  </select>
                  <button
                    onClick={handleRespond}
                    disabled={loading || !response.trim()}
                    className="px-4 py-2 bg-samsung-blue text-white rounded-lg hover:bg-samsung-blue-dark disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        답변 등록
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Actions - 본인 피드백이고 답변이 없으면 삭제 가능 */}
            {canDelete && (
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImage}
            alt="확대 이미지"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
