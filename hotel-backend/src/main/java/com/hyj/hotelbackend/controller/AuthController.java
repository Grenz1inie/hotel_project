package com.hyj.hotelbackend.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hyj.hotelbackend.auth.AuthUser;
import com.hyj.hotelbackend.auth.CurrentUserHolder;
import com.hyj.hotelbackend.auth.JwtUtil;
import com.hyj.hotelbackend.entity.User;
import com.hyj.hotelbackend.mapper.UserMapper;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest req) {
        if (req == null || !StringUtils.hasText(req.getUsername()) || !StringUtils.hasText(req.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "账号和密码必填");
        }
        String credential = req.getUsername().trim();
        String password = req.getPassword();
        
        // 账号长度校验
        if (credential.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "账号长度不能超过100个字符");
        }
        
        // 密码长度校验
        if (password.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码长度不能超过255个字符");
        }
        
        User u = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getPassword, password)
                .and(wrapper -> wrapper
                        .eq(User::getUsername, credential)
                        .or()
                        .eq(User::getPhone, credential)
                        .or()
                        .eq(User::getEmail, credential)));
        if (u == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "账号或密码错误");
        }
        String token = jwtUtil.generateToken(u.getId(), u.getUsername(), u.getRole(), u.getVipLevel());
        return Map.of(
                "token", token,
                "user", Map.of(
                        "id", u.getId(),
                        "username", u.getUsername(),
                        "role", u.getRole(),
                        "vipLevel", u.getVipLevel(),
                        "phone", u.getPhone(),
                        "email", u.getEmail() != null ? u.getEmail() : ""
                )
        );
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegisterRequest req) {
        // 1. 基础非空校验
        if (req == null || !StringUtils.hasText(req.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码必填");
        }
        
        // 2. 手机号校验（必填，因为用户名可能为空时需要用手机号）
        if (!StringUtils.hasText(req.getPhone())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "联系电话必填");
        }
        String phone = req.getPhone().trim();
        // 支持国内11位手机号（1开头）或国际号码格式（+开头或纯数字）
        if (!phone.matches("^(1[3-9]\\d{9}|\\+?[1-9]\\d{1,14})$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请输入正确的手机号（国内11位或国际号码）");
        }
        
        // 3. 用户名校验（可选，留空则使用手机号）
        String username;
        if (!StringUtils.hasText(req.getUsername()) || req.getUsername().trim().isEmpty()) {
            // 用户名为空，使用手机号
            username = phone;
        } else {
            username = req.getUsername().trim();
            // 如果提供了用户名，则需要验证格式
            if (username.length() < 3) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名至少3个字符");
            }
            if (username.length() > 20) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名最多20个字符");
            }
            if (!username.matches("^[a-zA-Z0-9_\\u4e00-\\u9fa5]+$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名只能包含字母、数字、下划线或中文");
            }
        }
        
        // 4. 密码校验
        String password = req.getPassword();
        if (password.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码至少6位");
        }
        if (password.length() > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码最多50位");
        }
        if (!password.matches("^(?=.*[A-Za-z0-9])[\\S]+$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码不能只包含空格，需包含字母或数字");
        }
        
        // 5. 确认密码校验
        if (req.getConfirmPassword() != null && !password.equals(req.getConfirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "两次输入的密码不一致");
        }
        
        // 6. 邮箱校验（可选）
        String email = null;
        if (StringUtils.hasText(req.getEmail())) {
            email = req.getEmail().trim();
            if (email.length() > 255) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邮箱长度不能超过255个字符");
            }
            if (!email.matches("^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邮箱格式不正确");
            }
        }
        
        // 7. 唯一性校验
        User existed = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (existed != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在");
        }
        User existedPhone = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (existedPhone != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该联系电话已注册");
        }
        if (email != null) {
            User existedEmail = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getEmail, email));
            if (existedEmail != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已注册");
            }
        }
        
        // 8. 创建用户
        User u = new User();
        u.setUsername(username);
        u.setPassword(password);
        u.setRole("USER");
        u.setVipLevel(0);
        u.setPhone(phone);
        if (email != null) {
            u.setEmail(email);
        }
        u.setStatus("ACTIVE");
        userMapper.insert(u);
        if (u.getId() == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "注册失败，请稍后再试");
        }
        
        // 9. 生成 Token 并返回
        String token = jwtUtil.generateToken(u.getId(), u.getUsername(), u.getRole(), u.getVipLevel());
        return Map.of(
                "token", token,
                "user", Map.of(
                        "id", u.getId(),
                        "username", u.getUsername(),
                        "role", u.getRole(),
                        "vipLevel", u.getVipLevel(),
                        "phone", u.getPhone(),
                        "email", u.getEmail() != null ? u.getEmail() : ""
                )
        );
    }

    @GetMapping("/me")
    public AuthUser me() {
        AuthUser currentUser = CurrentUserHolder.get();
        if (currentUser == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        
        // 从数据库重新读取最新的用户信息，确保 VIP 等级等字段是最新的
        User dbUser = userMapper.selectById(currentUser.getId());
        if (dbUser == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        
        // 返回最新的用户信息
        return new AuthUser(
            dbUser.getId(),
            dbUser.getUsername(),
            dbUser.getRole(),
            dbUser.getVipLevel()
        );
    }

    @Data
    public static class LoginRequest {
        private String username;
        private String password;
    }

    @Data
    public static class RegisterRequest {
        private String username;
        private String password;
        private String confirmPassword;
        private String phone;
        private String email;
    }
}
