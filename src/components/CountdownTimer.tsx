import { useEffect, useState } from "react";

interface CountdownProps {
  targetDate: string;
  title: string;
  danger?: boolean; // for registration countdown styling
}

export default function CountdownTimer({
  targetDate,
  title,
  danger = false,
}: CountdownProps) {
  const calculateTimeLeft = () => {
    const diff = +new Date(targetDate) - +new Date();

    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        expired: true,
      };
    }

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false,
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (timeLeft.expired) {
    return (
      <div style={styles.expired}>
        ⛔ {danger ? "Registration Closed" : "Event Started"}
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, ...(danger ? styles.dangerBox : {}) }}>
      <h3 style={{ ...styles.title, ...(danger ? styles.dangerText : {}) }}>
        {title}
      </h3>

      <div style={styles.timer}>
        {renderBox(timeLeft.days, "Days")}
        {renderBox(timeLeft.hours, "Hours")}
        {renderBox(timeLeft.minutes, "Minutes")}
        {renderBox(timeLeft.seconds, "Seconds")}
      </div>

      {danger && timeLeft.days === 0 && (
        <p style={styles.warning}>
          ⚠️ Hurry! Registration closes today by 8:00 PM
        </p>
      )}
    </div>
  );
}

function renderBox(value: number, label: string) {
  return (
    <div style={styles.box}>
      <span style={styles.value}>{value}</span>
      <span style={styles.label}>{label}</span>
    </div>
  );
}

const styles: any = {
  container: {
    background: "#f4f4f4",
    padding: 16,
    borderRadius: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  dangerBox: {
    background: "#fff0f0",
    border: "2px solid #ff4d4f",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#d32f2f",
  },
  dangerText: {
    color: "#d32f2f",
  },
  timer: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    color: "#d32f2f",
  },
  box: {
    background: "#fff",
    padding: "10px 14px",
    borderRadius: 8,
    minWidth: 70,
  },
  value: {
    fontSize: 20,
    fontWeight: "bold",
  },
  label: {
    fontSize: 12,
    color: "#666",
  },
  warning: {
    color: "red",
    fontWeight: "bold",
    marginTop: 10,
  },
  expired: {
    textAlign: "center",
    padding: 15,
    fontWeight: "bold",
    color: "#999",
  },
};
