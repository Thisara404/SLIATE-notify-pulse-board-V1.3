import React from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const getPageNumbers = () => {
    let pages = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // If we have less pages than we want to show, display all pages
      pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    } else {
      // Always include the first page
      pages.push(1)

      // Calculate start and end of pagination numbers
      let start = Math.max(2, currentPage - 1)
      let end = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if at the beginning
      if (currentPage <= 3) {
        end = Math.min(totalPages - 1, maxPagesToShow - 1)
      }

      // Adjust if at the end
      if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - (maxPagesToShow - 2))
      }

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push(-1) // Use -1 to represent "..."
      } else if (start === 2) {
        pages.push(2)
      }

      // Add middle pages
      for (let i = Math.max(start, 3); i <= Math.min(end, totalPages - 2); i++) {
        pages.push(i)
      }

      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push(-2) // Use -2 to represent "..." (second occurrence)
      } else if (end === totalPages - 1) {
        pages.push(totalPages - 1)
      }

      // Always include the last page
      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div className="flex items-center justify-center space-x-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous Page</span>
      </Button>

      {getPageNumbers().map((page, index) =>
        page < 0 ? (
          <span key={`ellipsis-${page}`} className="px-2 text-slate-500">
            ...
          </span>
        ) : (
          <Button
            key={`page-${page}`}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next Page</span>
      </Button>
    </div>
  )
}
