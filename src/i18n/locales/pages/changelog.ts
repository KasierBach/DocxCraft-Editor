export const changelogEn = {
  eyebrow: 'Release history',
  title: 'Changelog',
  intro: 'Every release, documented. The full commit history lives on GitHub.',
  releases: {
    v020: {
      label: 'Hosted release',
      groups: {
        added: {
          name: 'Added',
          items: {
            accounts:
              'Guest workspaces, and sign-in with Google or GitHub that merges a guest’s documents into the account',
            library:
              'A documents library and a settings page with data export and account deletion',
            menuLinks:
              'Open the home page, documentation, and changelog from the editor menu or command palette',
          },
        },
        changed: {
          name: 'Changed',
          items: {
            hostedStorage:
              'Documents can now live in Postgres with per-user ownership, quotas, and an audit log',
            landing:
              'Reworked the landing page for the hosted build, keeping the self-hosting path for developers',
            reorganized:
              'Reorganized the UI into feature folders and moved unit tests into __tests__ directories',
            dockerClaim:
              'Docker quick start now passes AUTH_MODE=claim so the first visit sets a passphrase',
          },
        },
        internal: {
          name: 'Internal',
          items: {
            migrations:
              'Prisma migrations and a migration step in the deploy compose, plus integration tests against a real Postgres',
            smokeTest:
              'The published Docker image is smoke-tested in CI before it is released',
          },
        },
      },
    },
    v010: {
      label: 'First public release',
      groups: {
        features: {
          name: 'Features',
          items: {
            nativeEditing: 'Native .docx editing with anchor navigation and page map',
            library: 'Document library with version history and restore',
            crashRecovery: 'Crash recovery via IndexedDB autosave',
            keyboard: 'Command palette, deep links, and full keyboard control',
            responsive: 'Responsive layout from desktop to phone with drawer sidebars',
            darkMode: 'Dark mode following the system preference',
          },
        },
        security: {
          name: 'Security',
          items: {
            passphraseAuth: 'Passphrase auth with first-run instance claiming',
            zipBomb: 'Zip-bomb-hardened upload validation',
            csp: 'Content-Security-Policy and hardened response headers',
            rateLimit: 'Rate limiting on API and login routes',
          },
        },
        deploy: {
          name: 'Deploy',
          items: {
            docker: 'One-command Docker image with automatic HTTPS',
            ghcr: 'Published to GitHub Container Registry with SBOM attestations',
          },
        },
      },
    },
  },
  older: {
    prefix: 'Older history and unreleased work: ',
    browseCommits: 'browse the commits',
  },
  back: '← Back to home',
};

export type ChangelogMessages = typeof changelogEn;

export const changelogVi: ChangelogMessages = {
  eyebrow: 'Lịch sử phát hành',
  title: 'Nhật ký thay đổi',
  intro: 'Mọi bản phát hành đều được ghi lại. Toàn bộ lịch sử commit có trên GitHub.',
  releases: {
    v020: {
      label: 'Bản phát hành hosted',
      groups: {
        added: {
          name: 'Đã thêm',
          items: {
            accounts:
              'Không gian khách, và đăng nhập bằng Google hoặc GitHub để gộp tài liệu của khách vào tài khoản',
            library:
              'Thư viện tài liệu và trang cài đặt có xuất dữ liệu và xóa tài khoản',
            menuLinks:
              'Mở trang chủ, tài liệu hướng dẫn và nhật ký thay đổi từ menu trình soạn thảo hoặc bảng lệnh',
          },
        },
        changed: {
          name: 'Đã thay đổi',
          items: {
            hostedStorage:
              'Tài liệu có thể lưu trong Postgres với quyền sở hữu theo người dùng, hạn mức và nhật ký kiểm toán',
            landing:
              'Làm lại trang chủ cho bản hosted, vẫn giữ hướng tự vận hành cho lập trình viên',
            reorganized:
              'Tổ chức lại giao diện thành các thư mục tính năng và chuyển các bài kiểm thử đơn vị vào thư mục __tests__',
            dockerClaim:
              'Khởi động nhanh bằng Docker giờ truyền AUTH_MODE=claim để lần truy cập đầu tiên đặt mật khẩu',
          },
        },
        internal: {
          name: 'Nội bộ',
          items: {
            migrations:
              'Migration của Prisma và bước chạy migration trong compose triển khai, kèm kiểm thử tích hợp với Postgres thật',
            smokeTest:
              'Ảnh Docker đã phát hành được kiểm thử nhanh trong CI trước khi phát hành',
          },
        },
      },
    },
    v010: {
      label: 'Bản phát hành công khai đầu tiên',
      groups: {
        features: {
          name: 'Tính năng',
          items: {
            nativeEditing: 'Chỉnh sửa .docx gốc với điều hướng mốc và bản đồ trang',
            library: 'Thư viện tài liệu với lịch sử phiên bản và phục hồi',
            crashRecovery: 'Phục hồi sau sự cố nhờ tự động lưu bằng IndexedDB',
            keyboard: 'Bảng lệnh, liên kết sâu và điều khiển hoàn toàn bằng bàn phím',
            responsive:
              'Bố cục thích ứng từ máy tính đến điện thoại với thanh bên dạng ngăn kéo',
            darkMode: 'Chế độ tối theo tùy chọn hệ thống',
          },
        },
        security: {
          name: 'Bảo mật',
          items: {
            passphraseAuth:
              'Xác thực bằng mật khẩu với việc nhận sở hữu phiên bản ở lần chạy đầu',
            zipBomb: 'Kiểm tra tải lên được tăng cường chống zip-bomb',
            csp: 'Content-Security-Policy và các tiêu đề phản hồi được tăng cường bảo mật',
            rateLimit: 'Giới hạn tần suất trên các tuyến API và đăng nhập',
          },
        },
        deploy: {
          name: 'Triển khai',
          items: {
            docker: 'Ảnh Docker chỉ với một lệnh cùng HTTPS tự động',
            ghcr: 'Phát hành lên GitHub Container Registry kèm chứng thực SBOM',
          },
        },
      },
    },
  },
  older: {
    prefix: 'Lịch sử cũ hơn và công việc chưa phát hành: ',
    browseCommits: 'xem các commit',
  },
  back: '← Về trang chủ',
};
