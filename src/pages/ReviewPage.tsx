// Bite Me Baby -- Review Page (CAT-04 Enhanced)
import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getVerifiedReviewsByProduct } from '@/lib/reviewApi'
import type { VerifiedCustomerReview } from '@/types'

export function ReviewPage() {
  const { productId } = useParams()
  const [verifiedReviews, setVerifiedReviews] = useState<VerifiedCustomerReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadReviews() {
      if (!productId) return
      try { setVerifiedReviews(await getVerifiedReviewsByProduct(productId)) }
      catch (e) { console.error('ReviewPage error:', e) }
      finally { setLoading(false) }
    }
    loadReviews()
  }, [productId])

  return (
    <div className='max-w-4xl mx-auto px-4 py-6'>
      <h1 className='text-3xl font-bold text-brand-accent mb-6'>Reviews</h1>
      <section className='mb-10'>
        <h2 className='text-xl font-display font-bold text-emerald-700 mb-4 flex items-center gap-2'><span className='w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold inline-flex items-center justify-center'>{'\u2713'}</span>Verified Customer Reviews</h2>
        {loading ? <p>Loading reviews...</p> : verifiedReviews.length > 0 ? verifiedReviews.map((review: any) => (
          <div key={review.id} className='card p-4 mb-3 border-l-4 border-emerald-500'>
            <div className='flex justify-between'><span className='font-medium'>{review.customer_name}</span><span>{'\\u2B50'.repeat(Math.round(review.rating))}</span></div>
            <p className='mt-2 text-sm'>{review.comment}</p>
            {review.order_number && <Link to='/orders' className='text-xs text-brand-primary mt-2 block'>Order #{review.order_number.slice(0,8)}</Link>}
            <span className='text-xs text-emerald-600 mt-1 block'>Verified Purchase {'\u2713'}</span>
          </div>)) : productId ? <div className='card bg-gray-50 text-center py-8'><p className='text-brand-muted'>No reviews yet.</p></div>
        : <div className='card bg-gray-50 text-center py-8'><p className='text-brand-muted'>No reviews yet. Waiting for real customer reviews.</p></div>}
      </section>
      <section className='mb-10'>
        <h2 className='text-xl font-display font-bold text-brand-accent mb-2'>Marketing Testimonials</h2>
        <p className='text-sm text-brand-muted'>Curated feedback from Facebook, GrabFood - marketing only.</p>
      </section>
      <section className='mb-10'>
        <h2 className='text-xl font-display font-bold text-brand-accent mb-3'>Admin Portfolio</h2>
        <div className='grid grid-cols-3 gap-3'>
          {[1,2,3].map(i =><div key={i} className='aspect-square rounded-lg bg-gray-100 overflow-hidden'><img src={'/images/mock/portfolio-'+i+'.webp'} alt={'Portfolio '+i} loading='lazy' className='w-full h-full object-cover' /></div>)}
        </div>
      </section>
    </div>
  )
}