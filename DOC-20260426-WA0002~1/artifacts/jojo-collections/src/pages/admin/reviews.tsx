import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListAdminReviews, useUpdateReviewStatus, useDeleteReview } from "@workspace/api-client-react";
import { Star, CheckCircle, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["all", "pending", "approved", "hidden"];

export default function AdminReviews() {
  const [filterStatus, setFilterStatus] = useState("pending");

  const { data: reviews, refetch, isLoading } = useListAdminReviews({
    status: filterStatus !== "all" ? filterStatus : undefined
  });
  
  const updateStatus = useUpdateReviewStatus();
  const deleteReview = useDeleteReview();

  const handleUpdateStatus = (id: string, status: "pending" | "approved" | "hidden") => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast.success(`Review marked as ${status}`);
        refetch();
      },
      onError: () => toast.error("Failed to update review status")
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to permanently delete this review?")) {
      deleteReview.mutate({ id }, {
        onSuccess: () => {
          toast.success("Review deleted");
          refetch();
        },
        onError: () => toast.error("Failed to delete review")
      });
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Reviews Moderation</h1>
          <p className="text-blue-900/70">Approve, hide, or manage customer reviews</p>
        </div>
        
        <div className="flex bg-white/20 backdrop-blur-md rounded-lg p-1 border border-white/30">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${
                filterStatus === s ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-800/70 hover:text-blue-900'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="text-center py-12 text-blue-800">Loading reviews...</div>
        ) : reviews?.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center border-white/40">
            <p className="text-blue-900/70 text-lg">No reviews found in this category.</p>
          </div>
        ) : (
          reviews?.map(review => (
            <div key={review.id} className="glass-panel-heavy rounded-2xl p-6 border-white/40 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-blue-950">{review.customerName}</h3>
                    <p className="text-xs text-blue-800/60 font-medium uppercase tracking-wider mb-2">
                      Product: {review.productName || "Unknown"}
                    </p>
                  </div>
                  <div className="flex text-yellow-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-current" : "text-blue-200"}`} />
                    ))}
                  </div>
                </div>
                
                <p className="text-blue-900/80 mb-4">{review.comment}</p>
                
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-blue-800/50">{new Date(review.createdAt).toLocaleString()}</span>
                  <span className="text-blue-800/30">•</span>
                  <span className={`px-2 py-0.5 rounded-full capitalize font-medium ${
                    review.status === 'approved' ? 'bg-green-100 text-green-800' :
                    review.status === 'hidden' ? 'bg-gray-200 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {review.status}
                  </span>
                </div>
              </div>
              
              <div className="flex md:flex-col gap-2 justify-end border-t md:border-t-0 md:border-l border-white/20 pt-4 md:pt-0 md:pl-6">
                {review.status !== 'approved' && (
                  <button 
                    onClick={() => handleUpdateStatus(review.id, 'approved')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors text-sm font-medium border border-green-200/50"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                )}
                {review.status !== 'hidden' && (
                  <button 
                    onClick={() => handleUpdateStatus(review.id, 'hidden')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors text-sm font-medium border border-gray-200/50"
                  >
                    <EyeOff className="w-4 h-4" /> Hide
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(review.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors text-sm font-medium border border-red-200/50 mt-auto"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
