package com.hyj.hotelbackend.config;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.common.auth.Credentials;
import com.aliyun.oss.common.auth.CredentialsProvider;
import com.aliyun.oss.common.auth.DefaultCredentials;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Setter
@Getter
@Configuration
@ConfigurationProperties(prefix = "aliyun.oss")
public class AliyunOssConfig {

    private static final Logger log = LoggerFactory.getLogger(AliyunOssConfig.class);

    // ========== getters and setters 保持不变 ==========
    private String endpoint;
    private String accessKeyId;
    private String accessKeySecret;
    private String bucketName;
    private String domain;

    @Bean
    public OSS ossClient() {
        if (StringUtils.hasText(accessKeyId) && StringUtils.hasText(accessKeySecret)) {
            log.info("OSS 客户端使用 AccessKey 方式初始化");
            return new OSSClientBuilder().build(endpoint, accessKeyId, accessKeySecret);
        } else {
            log.warn("未配置有效的 AccessKey，OSS 客户端将以匿名(公开读)模式运行，该模式下只能读取公开 Bucket 的资源");

            // v1 匿名访问变通方案：构建一个空的 CredentialsProvider
            CredentialsProvider anonymousProvider = new CredentialsProvider() {
                @Override
                public void setCredentials(Credentials creds) {}
                @Override
                public Credentials getCredentials() {
                    // 返回包含空字符串的凭证对象，绕过 null 检查
                    return new DefaultCredentials("", "", null);
                }
            };
            return new OSSClientBuilder().build(endpoint, anonymousProvider);
        }
    }

}
