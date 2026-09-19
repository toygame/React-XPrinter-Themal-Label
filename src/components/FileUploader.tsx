import React, { useRef, useState } from 'react';
import { Upload, FileText, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PdfDocumentInfo } from '../services/pdfService';

interface FileUploaderProps {
  pdfInfo: PdfDocumentInfo | null;
  currentPage: number;
  isLoading: boolean;
  onFileSelected: (file: File) => void;
  onLoadSample: () => void;
  onPageChange: (page: number) => void;
  onClear: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  pdfInfo,
  currentPage,
  isLoading,
  onFileSelected,
  onPageChange,
  onClear,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        onFileSelected(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="uploader-container">
      {!pdfInfo ? (
        <div
          className={`dropzone ${isDragging ? 'drag-active' : ''} ${isLoading ? 'loading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept="application/pdf"
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">
            <Upload size={32} />
          </div>
          <div className="dropzone-text">
            <strong>Drop your Shopee PDF label here</strong>
            <span>or click to browse from computer</span>
          </div>
        </div>
      ) : (
        <div className="file-card">
          <div className="file-card-info">
            <div className="file-icon-wrapper">
              <FileText size={24} />
            </div>
            <div className="file-meta">
              <span className="file-name" title={pdfInfo.fileName}>
                {pdfInfo.fileName}
              </span>
              <span className="file-details">
                {formatFileSize(pdfInfo.fileSize)} &bull; {pdfInfo.numPages}{' '}
                {pdfInfo.numPages === 1 ? 'page' : 'pages'}
              </span>
            </div>
          </div>

          <div className="file-card-actions">
            {pdfInfo.numPages > 1 && (
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn btn-icon"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => onPageChange(currentPage - 1)}
                  title="Previous Page"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="page-indicator">
                  Page {currentPage} of {pdfInfo.numPages}
                </span>
                <button
                  type="button"
                  className="btn btn-icon"
                  disabled={currentPage >= pdfInfo.numPages || isLoading}
                  onClick={() => onPageChange(currentPage + 1)}
                  title="Next Page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn btn-icon btn-danger"
              onClick={onClear}
              title="Remove document"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
