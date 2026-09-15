export const legalEn = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    lastUpdated: 'Last updated:',
    shortVersion: {
      title: 'The short version',
      body: 'This editor stores your documents in your workspace — a database plus file/object storage on a hosted instance, or the disk you run it on when self-hosted. There is no analytics, no telemetry, no advertising, and no third-party tracking. When accounts are enabled, signing in also stores the profile your provider returns (name, email, avatar); the operator of this instance is the data controller.',
    },
    whatIsStored: {
      title: 'What is stored',
      items: [
        {
          label: 'Documents.',
          body: 'The .docx files you open or save, plus version snapshots (100 per document by default, configurable), kept in your workspace’s storage.',
        },
        {
          label: 'Account data.',
          body: 'On hosted instances with accounts enabled: the name, email address, and avatar URL your sign-in provider returns, and an opaque session token stored only as a hash. On passphrase instances: a salted, hashed passphrase (scrypt), never stored in readable form and not recoverable.',
        },
        {
          label: 'Session cookie.',
          body: 'A single HTTP-only session cookie that keeps you signed in for up to 30 days (configurable). It holds an opaque token, not personal data.',
        },
        {
          label: 'Recovery drafts.',
          body: 'Unsaved edits are backed up in your own browser (IndexedDB/localStorage) and never leave your device.',
        },
      ],
    },
    notCollected: {
      title: 'What is not collected',
      body: 'No phone numbers, payment details, location data, or behavioural analytics. A signed-in account stores only the name, email, and avatar your provider returns; passphrase instances store no personal data at all. Server logs contain technical request metadata (timestamps, status codes, request IDs) used for troubleshooting.',
    },
    sharingDeletion: {
      title: 'Sharing and deletion',
      body: 'Your documents are never shared with, sold to, or sent to any third party. Deleting a document removes it and its version history; where accounts are enabled you can also export or delete your whole account from Settings. Contact the operator of this instance for anything else.',
    },
    operatorResponsibility: {
      title: 'Your responsibility as the operator',
      body: 'If you run this software for others, you are the data controller: keep the deployment updated, secure the passphrase, and back up the documents directory.',
    },
    back: 'Back',
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    lastUpdated: 'Last updated:',
    software: {
      title: 'The software',
      body: 'This editor is open-source software licensed under the MIT License and is provided “as is”, without warranty of any kind. The authors are not liable for any damages or data loss arising from its use.',
    },
    account: {
      title: 'Your account',
      body: 'Access is protected by a passphrase (self-hosted) or by signing in with Google or GitHub (hosted). You are responsible for keeping your credentials secret and for all activity performed under your session. A stored passphrase cannot be recovered by the operator; a hosted account can be signed out, exported, or deleted from Settings.',
    },
    documents: {
      title: 'Your documents',
      body: 'You retain all rights to the documents you store here. The software makes no claim of ownership and uses no document content for any purpose beyond saving, versioning, and serving it back to you.',
    },
    acceptableUse: {
      title: 'Acceptable use',
      body: 'Do not use this instance to store or distribute unlawful content, or to attack, overload, or probe the service. The operator may revoke access at any time.',
    },
    availability: {
      title: 'Availability',
      body: 'The service is provided on a best-effort basis with no uptime guarantee. Keep your own backups of important documents.',
    },
    back: 'Back',
  },
};

export type LegalMessages = typeof legalEn;

export const legalVi: LegalMessages = {
  privacy: {
    eyebrow: 'Quyền riêng tư',
    title: 'Chính sách quyền riêng tư',
    lastUpdated: 'Cập nhật lần cuối:',
    shortVersion: {
      title: 'Tóm tắt ngắn gọn',
      body: 'Trình soạn thảo này lưu tài liệu trong không gian làm việc của bạn — cơ sở dữ liệu kèm lưu trữ tệp/đối tượng trên bản hosted, hoặc đĩa bạn chạy khi tự vận hành. Không có phân tích, đo từ xa, quảng cáo hay theo dõi của bên thứ ba. Khi bật tài khoản, việc đăng nhập cũng lưu hồ sơ do nhà cung cấp trả về (tên, email, ảnh đại diện); người vận hành phiên bản này là đơn vị kiểm soát dữ liệu.',
    },
    whatIsStored: {
      title: 'Những gì được lưu trữ',
      items: [
        {
          label: 'Tài liệu.',
          body: 'Các tệp .docx bạn mở hoặc lưu, cùng ảnh chụp phiên bản (mặc định 100 cho mỗi tài liệu, có thể cấu hình), được giữ trong lưu trữ của không gian làm việc.',
        },
        {
          label: 'Dữ liệu tài khoản.',
          body: 'Trên bản hosted có bật tài khoản: tên, địa chỉ email và ảnh đại diện do nhà cung cấp đăng nhập trả về, cùng mã phiên chỉ lưu dưới dạng băm. Trên bản dùng mật khẩu: cụm mật khẩu đã thêm muối và băm (scrypt), không bao giờ lưu ở dạng đọc được và không thể khôi phục.',
        },
        {
          label: 'Cookie phiên.',
          body: 'Một cookie phiên HTTP-only duy nhất giúp bạn duy trì đăng nhập tối đa 30 ngày (có thể cấu hình). Cookie chứa mã không lộ nội dung, không chứa dữ liệu cá nhân.',
        },
        {
          label: 'Bản nháp khôi phục.',
          body: 'Các chỉnh sửa chưa lưu được sao lưu trong chính trình duyệt của bạn (IndexedDB/localStorage) và không bao giờ rời khỏi thiết bị của bạn.',
        },
      ],
    },
    notCollected: {
      title: 'Những gì không được thu thập',
      body: 'Không thu thập số điện thoại, chi tiết thanh toán, dữ liệu vị trí hay phân tích hành vi. Tài khoản đã đăng nhập chỉ lưu tên, email và ảnh đại diện do nhà cung cấp trả về; bản dùng mật khẩu không lưu dữ liệu cá nhân nào. Nhật ký máy chủ chứa siêu dữ liệu yêu cầu kỹ thuật (dấu thời gian, mã trạng thái, ID yêu cầu) dùng để khắc phục sự cố.',
    },
    sharingDeletion: {
      title: 'Chia sẻ và xóa',
      body: 'Tài liệu của bạn không bao giờ được chia sẻ, bán hoặc gửi cho bất kỳ bên thứ ba nào. Xóa một tài liệu sẽ xóa cả tài liệu và lịch sử phiên bản; khi bật tài khoản, bạn cũng có thể xuất hoặc xóa toàn bộ tài khoản trong phần Cài đặt. Hãy liên hệ người vận hành phiên bản này cho mọi vấn đề khác.',
    },
    operatorResponsibility: {
      title: 'Trách nhiệm của bạn với tư cách người vận hành',
      body: 'Nếu bạn chạy phần mềm này cho người khác, bạn là đơn vị kiểm soát dữ liệu: hãy cập nhật bản triển khai, bảo vệ cụm mật khẩu và sao lưu thư mục tài liệu.',
    },
    back: 'Quay lại',
  },
  terms: {
    eyebrow: 'Điều khoản',
    title: 'Điều khoản sử dụng',
    lastUpdated: 'Cập nhật lần cuối:',
    software: {
      title: 'Phần mềm',
      body: 'Trình soạn thảo này là phần mềm mã nguồn mở được cấp phép theo Giấy phép MIT và được cung cấp “nguyên trạng”, không kèm bất kỳ bảo đảm nào. Các tác giả không chịu trách nhiệm cho bất kỳ thiệt hại hay mất mát dữ liệu nào phát sinh từ việc sử dụng phần mềm.',
    },
    account: {
      title: 'Tài khoản của bạn',
      body: 'Quyền truy cập được bảo vệ bằng cụm mật khẩu (tự vận hành) hoặc bằng đăng nhập Google/GitHub (hosted). Bạn có trách nhiệm giữ bí mật thông tin đăng nhập và chịu trách nhiệm cho mọi hoạt động dưới phiên của bạn. Cụm mật khẩu đã lưu không thể được người vận hành khôi phục; tài khoản hosted có thể đăng xuất, xuất dữ liệu hoặc xóa trong phần Cài đặt.',
    },
    documents: {
      title: 'Tài liệu của bạn',
      body: 'Bạn giữ mọi quyền đối với các tài liệu bạn lưu tại đây. Phần mềm không đưa ra bất kỳ tuyên bố sở hữu nào và không sử dụng nội dung tài liệu cho bất kỳ mục đích nào ngoài việc lưu, tạo phiên bản và trả lại cho bạn.',
    },
    acceptableUse: {
      title: 'Sử dụng được phép',
      body: 'Không sử dụng phiên bản này để lưu trữ hoặc phân phối nội dung trái pháp luật, hoặc để tấn công, làm quá tải hay thăm dò dịch vụ. Người vận hành có thể thu hồi quyền truy cập bất cứ lúc nào.',
    },
    availability: {
      title: 'Tính sẵn sàng',
      body: 'Dịch vụ được cung cấp trên cơ sở nỗ lực tối đa và không cam kết thời gian hoạt động. Hãy tự sao lưu các tài liệu quan trọng của bạn.',
    },
    back: 'Quay lại',
  },
};
