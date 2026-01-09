module.exports = {
    HTML: function (title, body) {
        return `
    <!doctype html>
    <html>
    <head>
      <title>코딩앤플레이 - ${title}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        @import url(https://fonts.googleapis.com/earlyaccess/notosanskr.css);

        * {
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans KR', sans-serif;
            background-color: #f0f0f0;
            margin: 0;
            padding: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .container {
            background-color: white;
            padding: 30px 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }

        .container > div[style*="text-align"] {
            margin-bottom: 20px;
        }

        .container img {
            width: 100px !important;
            height: auto !important;
            max-width: 150px;
        }

        h2 {
            color: #333;
            margin: 0 0 20px;
            font-size: 22px;
            text-align: center;
        }

        form {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .login, input[type="text"], input[type="password"], input[type="email"], input[type="tel"], input[type="date"], select {
            width: 100%;
            padding: 14px 12px;
            margin-bottom: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #f8f9fa;
            font-size: 16px;
            box-sizing: border-box;
            -webkit-appearance: none;
        }

        .login:focus, input:focus, select:focus {
            outline: none;
            border-color: #333;
            background-color: white;
        }

        .btn {
            width: 100%;
            background-color: black;
            color: white;
            padding: 14px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            margin-top: 10px;
            transition: background-color 0.3s ease;
        }

        .btn:hover {
            background-color: #333;
        }

        .btn:active {
            background-color: #000;
            transform: scale(0.98);
        }

        .register-link {
            margin-top: 20px;
            color: #666;
            font-size: 14px;
            text-align: center;
        }

        .register-link a {
            color: #333;
            text-decoration: none;
            font-weight: bold;
        }

        .error-message {
            color: red;
            margin-top: 15px;
            font-size: 14px;
            text-align: center;
        }

        /* 모바일 반응형 - 작은 화면 */
        @media (max-width: 480px) {
            body {
                padding: 15px;
            }

            .container {
                padding: 25px 20px;
                border-radius: 10px;
            }

            .container img {
                width: 80px !important;
            }

            h2 {
                font-size: 20px;
                margin-bottom: 18px;
            }

            .login, input[type="text"], input[type="password"], input[type="email"], input[type="tel"], input[type="date"], select {
                padding: 15px 12px;
                font-size: 16px;
                margin-bottom: 10px;
            }

            .btn {
                padding: 15px;
                font-size: 16px;
            }

            .register-link {
                font-size: 14px;
                margin-top: 18px;
            }

            .error-message {
                font-size: 14px;
            }
        }

        /* 태블릿 및 중간 크기 화면 */
        @media (min-width: 481px) and (max-width: 768px) {
            .container {
                max-width: 450px;
                padding: 35px 30px;
            }

            .container img {
                width: 110px !important;
            }

            h2 {
                font-size: 24px;
            }
        }

        /* 큰 화면 */
        @media (min-width: 769px) {
            .container {
                max-width: 420px;
            }
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${body}
        <div id="error-message" class="error-message"></div>
      </div>
      <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
      <script>
        $(document).ready(function() {
            $('#loginForm').on('submit', function(e) {
                e.preventDefault();
                const userID = $('input[name="userID"]').val();
                const password = $('input[name="password"]').val(); // 'pwd' -> 'password'로 수정

                if (!userID || !password) {
                    $('#error-message').text('아이디와 비밀번호를 입력해주세요.');
                    return;
                }

                $.ajax({
                    url: '/auth/login_process',
                    method: 'POST',
                    data: JSON.stringify({ userID, password }),
                    contentType: 'application/json',
                    success: function(response) {
                        if (response.success) {
                            window.location.href = response.redirect;
                        } else {
                            $('#error-message').text(response.error || '로그인 중 오류가 발생했습니다.');
                        }
                    },
                    error: function(xhr) {
                        $('#error-message').text(xhr.responseJSON?.error || '로그인 중 오류가 발생했습니다.');
                    }
                });
            });
        });
      </script>
    </body>
    </html>
        `;
    }
}