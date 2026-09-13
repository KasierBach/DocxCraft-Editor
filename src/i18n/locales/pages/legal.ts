export const legalEn = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    lastUpdated: 'Last updated:',
    shortVersion: {
      title: 'The short version',
      body: 'This editor stores your documents on this server and collects nothing else. There is no analytics, no telemetry, no advertising, and no third-party tracking. The operator of this server is the data controller for the documents you store here.',
    },
    whatIsStored: {
      title: 'What is stored',
      items: [
        {
          label: 'Documents.',
          body: 'The .docx files you open or save, and up to 100 version snapshots per document, kept in this server’s local storage.',
        },
        {
          label: 'Account security data.',
          body: 'A salted, hashed passphrase (scrypt). The passphrase itself is never stored in readable form and cannot be recovered.',
        },
        {
          label: 'Session cookie.',
          body: 'A single HTTP-only cookie that keeps you signed in for up to 7 days. It contains a signed expiry timestamp and no personal data.',
        },
        {
          label: 'Recovery drafts.',
          body: 'Unsaved edits are backed up in your own browser (IndexedDB/localStorage) and never leave your device.',
        },
      ],
    },
    notCollected: {
      title: 'What is not collected',
      body: 'No names, email addresses, phone numbers, payment details, location data, or behavioural analytics. The server logs contain technical request metadata (timestamps, status codes, request IDs) used for troubleshooting and are kept by the operator only.',
    },
    sharingDeletion: {
      title: 'Sharing and deletion',
      body: 'Your documents are never shared with, sold to, or sent to any third party. Deleting a document in the editor removes it and its version history from the server. Contact the operator of this instance for anything else.',
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
      body: 'Access is protected by a passphrase. You are responsible for keeping it secret and for all activity performed under your session. Because the passphrase is stored only as a hash, it cannot be recovered or reset by the operator without resetting the instance.',
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
      body: 'Trình soạn thảo này lưu tài liệu của bạn trên máy chủ này và không thu thập gì khác. Không có phân tích, không có đo từ xa, không có quảng cáo và không có theo dõi của bên thứ ba. Người vận hành máy chủ này là đơn vị kiểm soát dữ liệu đối với các tài liệu bạn lưu tại đây.',
    },
    whatIsStored: {
      title: 'Những gì được lưu trữ',
      items: [
        {
          label: 'Tài liệu.',
          body: 'Các tệp .docx bạn mở hoặc lưu, cùng tối đa 100 ảnh chụp phiên bản cho mỗi tài liệu, được giữ trong bộ nhớ cục bộ của máy chủ này.',
        },
        {
          label: 'Dữ liệu bảo mật tài khoản.',
          body: 'Cụm mật khẩu đã được thêm muối và băm (scrypt). Bản thân cụm mật khẩu không bao giờ được lưu ở dạng đọc được và không thể khôi phục.',
        },
        {
          label: 'Cookie phiên.',
          body: 'Một cookie HTTP-only duy nhất giúp bạn duy trì đăng nhập trong tối đa 7 ngày. Cookie chứa dấu thời gian hết hạn đã ký và không chứa dữ liệu cá nhân.',
        },
        {
          label: 'Bản nháp khôi phục.',
          body: 'Các chỉnh sửa chưa lưu được sao lưu trong chính trình duyệt của bạn (IndexedDB/localStorage) và không bao giờ rời khỏi thiết bị của bạn.',
        },
      ],
    },
    notCollected: {
      title: 'Những gì không được thu thập',
      body: 'Không thu thập tên, địa chỉ email, số điện thoại, chi tiết thanh toán, dữ liệu vị trí hay phân tích hành vi. Nhật ký máy chủ chứa siêu dữ liệu yêu cầu kỹ thuật (dấu thời gian, mã trạng thái, ID yêu cầu) dùng để khắc phục sự cố và chỉ do người vận hành lưu giữ.',
    },
    sharingDeletion: {
      title: 'Chia sẻ và xóa',
      body: 'Tài liệu của bạn không bao giờ được chia sẻ, bán hoặc gửi cho bất kỳ bên thứ ba nào. Xóa một tài liệu trong trình soạn thảo sẽ xóa tài liệu đó và lịch sử phiên bản của nó khỏi máy chủ. Hãy liên hệ người vận hành phiên bản này cho mọi vấn đề khác.',
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
      body: 'Quyền truy cập được bảo vệ bằng một cụm mật khẩu. Bạn có trách nhiệm giữ bí mật cụm mật khẩu và chịu trách nhiệm cho mọi hoạt động được thực hiện dưới phiên của bạn. Vì cụm mật khẩu chỉ được lưu dưới dạng băm, người vận hành không thể khôi phục hay đặt lại nó mà không đặt lại phiên bản.',
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
