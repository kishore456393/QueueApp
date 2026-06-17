// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AuthPage from "../pages/auth";
import { AuthProvider } from "../hooks/useAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Hoist mocks to ensure they are available in vi.mock
const { mockApiRequest, mockSetQueryData } = vi.hoisted(() => {
    return {
        mockApiRequest: vi.fn(),
        mockSetQueryData: vi.fn()
    };
});

// Mock apiRequest and queryClient
vi.mock("@/lib/queryClient", () => ({
    apiRequest: mockApiRequest,
    queryClient: {
        setQueryData: mockSetQueryData,
        getQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
    },
}));

// Mock Toast
vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({
        toast: vi.fn(),
    }),
}));

// Create a real QueryClient for the provider in tests
const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const renderAuthPage = () => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <AuthPage />
            </AuthProvider>
        </QueryClientProvider>
    );
};

describe("AuthPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock for user check (not logged in)
        mockApiRequest.mockImplementation((method, url) => {
            if (url === "/api/user") return Promise.reject(new Error("Unauthorized"));
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    it("renders login form by default", async () => {
        renderAuthPage();
        expect(screen.getByText("Sign in")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    });

    it("switches to register form", async () => {
        renderAuthPage();
        fireEvent.click(screen.getByText("Create account"));
        await waitFor(() => {
            expect(screen.getByText("Create your account")).toBeInTheDocument();
            expect(screen.getByPlaceholderText("First Name")).toBeInTheDocument();
        });
    });

    it("validates required fields on login", async () => {
        renderAuthPage();
        fireEvent.click(screen.getByText("Next"));
        await waitFor(() => {
            expect(screen.getByText("Username is required")).toBeInTheDocument();
            expect(screen.getByText("Password is required")).toBeInTheDocument();
        });
    });

    it("shows error for weak password on register", async () => {
        renderAuthPage();
        fireEvent.click(screen.getByText("Create account"));

        const passwordInput = screen.getByPlaceholderText("Password");
        fireEvent.change(passwordInput, { target: { value: "weak" } });
        fireEvent.blur(passwordInput);

        await waitFor(() => {
            expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
        });
    });

    it("calls login API on valid submit", async () => {
        mockApiRequest.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ username: "test" }) });
        renderAuthPage();

        fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "testuser" } });
        fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "Password123!" } });
        fireEvent.click(screen.getByText("Next"));

        await waitFor(() => {
            expect(mockApiRequest).toHaveBeenCalledWith("POST", "/api/login", {
                username: "testuser",
                password: "Password123!",
            });
        });
    });

    it("checks username availability", async () => {
        mockApiRequest.mockImplementation((method, url) => {
            if (url.includes("check-username")) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ available: false }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        renderAuthPage();
        fireEvent.click(screen.getByText("Create account"));

        const usernameInput = screen.getByPlaceholderText("Username");
        fireEvent.change(usernameInput, { target: { value: "takenuser" } });

        // Wait for debounce and API call
        await waitFor(() => {
            expect(screen.getByText("Username taken")).toBeInTheDocument();
        }, { timeout: 1000 });
    });
});
