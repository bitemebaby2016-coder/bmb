import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { showToast } from '@/components/ui/ToastContainer'

export function ReviewPage() {
  const { productId } = useParams()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reviews, setReviews] = useState<any[]>([
    { id: '1', user: 'สมชาย', rating: 5, comment: 'อร่อยมาก! ส่งไว', date: '2026-09-08' },
    { id: '2', user: 'สมหิง', rating: 4, comment: 'ดีแต่รอ稍', date: '2026-09-07' },
  ])

  function handleSubmit() {
    if (rating === 0) {
      showToast('กรุาให้คะแนน', 'warning')
      return
    }
    if (!comment.trim()) {
      showToast('กรุาเขียนรีวิว', 'warning')
      return
    }

    const newReview = {
      id: Date.now().toString(),
      user: 'คุ',
      rating,
      comment,
      date: new Date().toISOString().split('T')[0]
    }

    setReviews([newReview, ...reviews])
    showToast('ส่งรีวิวสำเรจ! ได้ +10 แต้ม', 'success')
    setRating(0)
    setComment('')
  }

  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-brand-accent mb-6">⭐ รีวิวเมน</h1>

      {/* Rating Summary */}
      <div className="card mb-6 bg-gradient-to-r from-yellow-50 to-orange-50">
        <div className="flex items-center gap-4">
          <div className="text-5xl font-bold text-brand-accent">{averageRating.toFixed(1)}</div>
          <div>
            <div className="text-2xl mb-1">{'⭐'.repeat(Math.round(averageRating))}</div>
            <div className="text-brand-muted">จาก {reviews.length} รีวิว</div>
          </div>
        </div>
      </div>

      {/* Write Review Form */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">✍️ เขียนรีวิว</h3>
        
        <div className="mb-4">
          <div className="text-sm text-brand-muted mb-2">ให้คะแนน:</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-4xl transition-transform hover:scale-125 ${
                  star <= rating ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
        </div>

        <textarea
          placeholder="เขียนรีวิวของคุ..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="input mb-4 min-h-[100px]"
          rows={4}
        />

        <button onClick={handleSubmit} className="btn btn-primary">
          📤 ส่งรีวิว
        </button>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="card">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-brand-accent">{review.user}</div>
                <div className="text-sm text-brand-muted">{review.date}</div>
              </div>
              <div className="text-yellow-400">{'⭐'.repeat(review.rating)}</div>
            </div>
            <p className="text-brand-accent">{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  )
}