1. Chạy file "link_crawler.js" trước để lấy các thuộc tính và đường dẫn trước. Mỗi page gồm 20 links sẽ được lưu trong folder raw_data bắt đầu từ 000001.json
2. Chỉnh sửa file log.json: "cur" là file bắt đầu (ví dụ 1 là file 000001.json), end là vị trí kết thúc. Error là mảng các page cần kiểm tra lại (error < cur>)
3. Chạy file index.json (npm start) để download