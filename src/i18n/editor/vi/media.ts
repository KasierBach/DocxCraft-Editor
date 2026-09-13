import type { Translations } from '@eigenpal/docx-editor-i18n';

/** image, imageTransform, imageWrap, imageOverlay, headerFooter, hyperlinkPopup, responsePreview */
export const mediaVi: Translations = {
  image: {
    placeholder: 'Vị trí hình ảnh',
    placeholderText: '[Hình ảnh]',
    editableAriaLabel: 'Hình ảnh có thể chỉnh sửa',
  },
  imageTransform: {
    tooltip: 'Biến đổi',
    rotateClockwise: 'Xoay theo chiều kim đồng hồ',
    rotateCounterClockwise: 'Xoay ngược chiều kim đồng hồ',
    flipHorizontal: 'Lật ngang',
    flipVertical: 'Lật dọc',
  },
  imageWrap: {
    inline: 'Cùng dòng với văn bản',
    floatLeft: 'Vuông bên trái',
    floatRight: 'Vuông bên phải',
    topAndBottom: 'Trên và dưới',
    behindText: 'Phía sau văn bản',
    inFrontOfText: 'Phía trước văn bản',
    tooltipPrefix: 'Bao văn bản: {label}',
    menu: {
      inLineWithText: 'Cùng dòng với văn bản',
      squareLeft: 'Vuông bên trái',
      squareRight: 'Vuông bên phải',
      behindText: 'Phía sau văn bản',
      inFrontOfText: 'Phía trước văn bản',
      ariaLabel: 'Tùy chọn bố cục hình ảnh',
      imageProperties: 'Thuộc tính hình ảnh…',
    },
    menuDesc: {
      inLineWithText: 'Hình ảnh nằm trong dòng như một ký tự',
      squareLeft: 'Hình ảnh nổi bên trái, văn bản bao quanh bên phải',
      squareRight: 'Hình ảnh nổi bên phải, văn bản bao quanh bên trái',
      behindText: 'Hình ảnh được vẽ phía sau văn bản chính',
      inFrontOfText: 'Hình ảnh được vẽ đè lên văn bản chính',
    },
  },
  imageOverlay: {
    rotate: 'Xoay',
    imageProperties: 'Thuộc tính hình ảnh',
    deleteImage: 'Xóa hình ảnh',
    replaceImage: 'Thay thế hình ảnh…',
  },
  headerFooter: {
    header: 'Đầu trang',
    footer: 'Chân trang',
    options: 'Tùy chọn',
    insertPageNumber: 'Chèn số trang hiện tại',
    insertTotalPages: 'Chèn tổng số trang',
    remove: 'Xóa {label}',
    closeEditing: 'Đóng chỉnh sửa {label}',
  },
  hyperlinkPopup: {
    displayTextPlaceholder: 'Văn bản hiển thị',
    urlPlaceholder: 'https://example.com',
    copyLink: 'Sao chép liên kết',
    editLink: 'Chỉnh sửa liên kết',
    removeLink: 'Xóa liên kết',
  },
  responsePreview: {
    loading: '{action}...',
    result: 'Kết quả {action}',
    closeEsc: 'Đóng (Esc)',
    editPrompt: 'Chỉnh sửa kết quả trước khi chấp nhận:',
    changes: 'Thay đổi:',
    original: 'Bản gốc:',
    new: 'Mới:',
    cancelEdit: 'Hủy chỉnh sửa',
  },
};
