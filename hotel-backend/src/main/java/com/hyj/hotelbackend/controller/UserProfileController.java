package com.hyj.hotelbackend.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.hyj.hotelbackend.auth.AuthUser;
import com.hyj.hotelbackend.auth.CurrentUserHolder;
import com.hyj.hotelbackend.entity.User;
import com.hyj.hotelbackend.mapper.UserMapper;
import com.hyj.hotelbackend.service.WalletService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/users/me")
public class UserProfileController {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private WalletService walletService;

    @GetMapping("/profile")
    public Map<String, Object> profile() {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        User user = userMapper.selectById(me.getId());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        return buildUserProfileResponse(user);
    }

    @PostMapping("/check-vip-upgrade")
    public Map<String, Object> checkVipUpgrade() {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        
        // 获取升级前的等级
        User userBefore = userMapper.selectById(me.getId());
        if (userBefore == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        Integer oldLevel = userBefore.getVipLevel() != null ? userBefore.getVipLevel() : 0;
        
        // 检查并升级VIP等级
        walletService.checkAndUpgradeVipLevel(me.getId());
        
        // 获取升级后的等级
        User userAfter = userMapper.selectById(me.getId());
        Integer newLevel = userAfter.getVipLevel() != null ? userAfter.getVipLevel() : 0;
        BigDecimal totalConsumption = userAfter.getTotalConsumption() != null ? userAfter.getTotalConsumption() : BigDecimal.ZERO;
        
        java.util.HashMap<String, Object> response = new java.util.HashMap<>();
        response.put("upgraded", newLevel > oldLevel);
        response.put("oldLevel", oldLevel);
        response.put("newLevel", newLevel);
        response.put("yearlyConsumption", totalConsumption);
        
        return response;
    }

    @PutMapping("/profile")
    public Map<String, Object> update(@RequestBody UpdateProfileRequest request) {
        AuthUser me = CurrentUserHolder.get();
        if (me == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请求体不能为空");
        }
        User user = userMapper.selectById(me.getId());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
        String username = normalize(request.getUsername());
        String phone = normalize(request.getPhone());
        String email = normalize(request.getEmail());
        if (username != null) {
            if (username.length() < 3) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名至少 3 个字符");
            }
            User existed = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getUsername, username)
                    .ne(User::getId, user.getId()));
            if (existed != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已被占用");
            }
            user.setUsername(username);
        }
        if (phone != null) {
            // 支持国内11位手机号（1开头）或国际号码格式（+开头或纯数字）
            if (!phone.matches("^(1[3-9]\\d{9}|\\+?[1-9]\\d{1,14})$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请输入正确的手机号（国内11位或国际号码）");
            }
            User existedPhone = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getPhone, phone)
                    .ne(User::getId, user.getId()));
            if (existedPhone != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "联系电话已被占用");
            }
            user.setPhone(phone);
        }
        if (StringUtils.hasText(email)) {
            if (email.length() > 255) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邮箱长度不能超过255个字符");
            }
            if (!email.matches("^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邮箱格式不正确");
            }
            User existedEmail = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getEmail, email)
                    .ne(User::getId, user.getId()));
            if (existedEmail != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "邮箱已被占用");
            }
            user.setEmail(email);
        } else {
            user.setEmail(null);
        }
        userMapper.updateById(user);
        return buildUserProfileResponse(user);
    }

    private Map<String, Object> buildUserProfileResponse(User user) {
        java.util.HashMap<String, Object> response = new java.util.HashMap<>();
        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("phone", user.getPhone());
        response.put("email", user.getEmail() != null ? user.getEmail() : "");
        response.put("role", user.getRole());
        response.put("vipLevel", user.getVipLevel());
        response.put("status", user.getStatus());
        response.put("createdAt", user.getCreatedAt());
        response.put("updatedAt", user.getUpdatedAt());
        
        // 直接使用累计消费金额字段 (total_consumption)
        BigDecimal totalConsumption = user.getTotalConsumption() != null ? user.getTotalConsumption() : BigDecimal.ZERO;
        response.put("yearlyConsumption", totalConsumption);
        
        return response;
    }

    private String normalize(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    @Data
    public static class UpdateProfileRequest {
        private String username;
        private String phone;
        private String email;
    }
}
