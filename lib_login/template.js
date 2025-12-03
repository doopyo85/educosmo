module.exports = {
    HTML: function (title, body) {
        return `
    <!doctype html>
    <html>
    <head>
      <title>코딩앤플레이 - ${title}</title>
      <meta charset="utf-8">
      <style>
        @import url(https://fonts.googleapis.com/earlyaccess/notosanskr.css);

        body {
            font-family: 'Noto Sans KR', sans-serif;
            background-color: #f0f0f0;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .container {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 300px;
        }

        h2 {
            color: #333;
            margin: 0 0 15px;
            font-size: 18px;
            text-align: center;
        }

        form {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .login, input[type="text"], input[type="password"], input[type="email"], input[type="tel"], input[type="date"], select {
            width: 100%;
            padding: 8px;
            margin-bottom: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f8f9fa;
            font-size: 14px;
            box-sizing: border-box;
        }

        .btn {            
            width: 100%;
            background-color: black;
            color: white;
            padding: 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
        }

        .register-link {
            margin-top: 15px;
            color: #666;
            font-size: 12px;
            text-align: center;
        }

        .register-link a {
            color: #333;
            text-decoration: none;
            font-weight: bold;
        }

        .error-message {
            color: red;
            margin-top: 10px;
            font-size: 12px;
            text-align: center;
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