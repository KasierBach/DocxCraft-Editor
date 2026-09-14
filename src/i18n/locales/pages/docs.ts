export const docsEn = {
  eyebrow: 'Documentation',
  title: 'Docs',
  intro: 'Everything needed to run, configure, and harden DocxCraft.',
  back: '← Back to home',
  quickStart: {
    heading: 'Quick start',
    dockerLead: 'Self-host with Docker.',
    dockerCopy:
      'Documents persist in the named volume; open the URL and set your passphrase on first visit.',
    localLead: 'Run it locally.',
    localCopy:
      'Node 22.12+ and npm are the only requirements; the dev launcher starts the API and editor together.',
  },
  config: {
    heading: 'Configuration',
    intro: 'All settings are environment variables with sensible defaults.',
    columns: {
      variable: 'Variable',
      default: 'Default',
      purpose: 'Purpose',
    },
    variables: {
      port: 'HTTP port the server binds to',
      host: 'Bind address — keep localhost unless behind TLS',
      dataDir: 'Where documents and versions are stored',
      documentStore: 'Persistence driver: "file" (single machine) or "postgres"',
      databaseUrl: 'Postgres connection string, required when DOCUMENT_STORE=postgres',
      blobDir: 'Where .docx blob files are stored for the postgres store',
      authMode: 'Set to "claim" so the first visit sets the passphrase',
      authPassphraseHash: 'Pre-seed the passphrase (npm run hash-passphrase)',
      authPassphrase: 'Plaintext passphrase, hashed at boot (alternative to the hash)',
      authStateFile: 'Where the claimed passphrase hash is stored (defaults beside DATA_DIR)',
      corsOrigin: 'Allow browser clients from other origins',
      logLevel: 'Server log level',
    },
  },
  shortcuts: {
    heading: 'Keyboard shortcuts',
    columns: {
      shortcut: 'Shortcut',
      action: 'Action',
    },
    actions: {
      save: 'Save the current document',
      saveAs: 'Save as a new copy',
      open: 'Open a .docx from your computer',
      palette: 'Command palette',
      help: 'Keyboard shortcut help',
      outline: 'Toggle the outline sidebar',
      details: 'Toggle the details sidebar',
    },
  },
  gettingHelp: {
    heading: 'Getting help',
    bodyPrefix: 'From inside the editor, open the ',
    moreActions: 'More actions',
    bodySuffix:
      ' menu (the ⋯ button) and choose Documentation, Changelog, or Home page. These pages open over the editor, so an open document and any unsaved changes are kept. They are also available from the command palette.',
  },
  security: {
    heading: 'Security model',
    items: {
      uploads:
        'Uploads are validated before decompression: ZIP structure, entry count, path traversal, zip-bomb ratios, and CRC32.',
      rateLimit: 'All API routes are rate-limited; login attempts have their own tighter limit.',
      headers:
        'Strict Content-Security-Policy, X-Frame-Options, and nosniff headers on every response.',
      concurrency:
        'Optimistic concurrency: stale saves are rejected with a 409 instead of overwriting.',
    },
    readmePrefix:
      'The full architecture, API reference, and deployment notes live in the ',
    readmeLink: 'repository README',
    readmeSuffix: '.',
  },
};

export type DocsMessages = typeof docsEn;

export const docsVi: DocsMessages = {
  eyebrow: 'Tài liệu hướng dẫn',
  title: 'Tài liệu',
  intro: 'Mọi thứ cần thiết để chạy, cấu hình và tăng cường bảo mật cho DocxCraft.',
  back: '← Về trang chủ',
  quickStart: {
    heading: 'Bắt đầu nhanh',
    dockerLead: 'Tự lưu trữ bằng Docker.',
    dockerCopy:
      'Tài liệu được lưu trong volume có tên; mở URL và đặt mật khẩu ở lần truy cập đầu tiên.',
    localLead: 'Chạy cục bộ.',
    localCopy:
      'Chỉ cần Node 22.12+ và npm; trình khởi chạy dev sẽ khởi động cả API và trình soạn thảo cùng lúc.',
  },
  config: {
    heading: 'Cấu hình',
    intro: 'Mọi cài đặt đều là biến môi trường với giá trị mặc định hợp lý.',
    columns: {
      variable: 'Biến',
      default: 'Mặc định',
      purpose: 'Mục đích',
    },
    variables: {
      port: 'Cổng HTTP mà máy chủ lắng nghe',
      host: 'Địa chỉ liên kết — giữ localhost trừ khi đứng sau TLS',
      dataDir: 'Nơi lưu trữ tài liệu và các phiên bản',
      documentStore: 'Trình lưu trữ: "file" (một máy) hoặc "postgres"',
      databaseUrl: 'Chuỗi kết nối Postgres, bắt buộc khi DOCUMENT_STORE=postgres',
      blobDir: 'Nơi lưu các tệp .docx cho trình lưu trữ postgres',
      authMode: 'Đặt thành "claim" để lần truy cập đầu tiên thiết lập mật khẩu',
      authPassphraseHash: 'Đặt trước mật khẩu (npm run hash-passphrase)',
      authPassphrase: 'Mật khẩu dạng văn bản thuần, được băm khi khởi động (thay thế cho hash)',
      authStateFile: 'Nơi lưu hash mật khẩu đã thiết lập (mặc định bên cạnh DATA_DIR)',
      corsOrigin: 'Cho phép máy khách trình duyệt từ các origin khác',
      logLevel: 'Mức nhật ký của máy chủ',
    },
  },
  shortcuts: {
    heading: 'Phím tắt',
    columns: {
      shortcut: 'Phím tắt',
      action: 'Hành động',
    },
    actions: {
      save: 'Lưu tài liệu hiện tại',
      saveAs: 'Lưu thành bản sao mới',
      open: 'Mở tệp .docx từ máy tính của bạn',
      palette: 'Bảng lệnh',
      help: 'Trợ giúp phím tắt',
      outline: 'Bật/tắt thanh bên dàn ý',
      details: 'Bật/tắt thanh bên chi tiết',
    },
  },
  gettingHelp: {
    heading: 'Nhận trợ giúp',
    bodyPrefix: 'Từ trong trình soạn thảo, mở ',
    moreActions: 'Thao tác khác',
    bodySuffix:
      ' (nút ⋯) và chọn Tài liệu hướng dẫn, Nhật ký thay đổi hoặc Trang chủ. Các trang này mở đè lên trình soạn thảo, nên tài liệu đang mở và mọi thay đổi chưa lưu đều được giữ nguyên. Chúng cũng có sẵn từ bảng lệnh.',
  },
  security: {
    heading: 'Mô hình bảo mật',
    items: {
      uploads:
        'Tệp tải lên được kiểm tra trước khi giải nén: cấu trúc ZIP, số lượng mục, đường dẫn di chuyển, tỷ lệ bom zip và CRC32.',
      rateLimit: 'Mọi tuyến API đều được giới hạn tốc độ; các lần đăng nhập có giới hạn chặt hơn riêng.',
      headers:
        'Content-Security-Policy nghiêm ngặt, X-Frame-Options và tiêu đề nosniff trên mọi phản hồi.',
      concurrency:
        'Đồng thời lạc quan: các bản lưu cũ bị từ chối với mã 409 thay vì ghi đè.',
    },
    readmePrefix: 'Kiến trúc đầy đủ, tham chiếu API và ghi chú triển khai nằm trong ',
    readmeLink: 'README của kho lưu trữ',
    readmeSuffix: '.',
  },
};
